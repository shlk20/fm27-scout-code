//! Read-only access to the FM27 save container.
//!
//! A save is a 26-byte header, a run of zstd frames, and a trailer which holds a
//! compressed directory listing the named frames. Offsets in the directory are
//! relative to the end of the header (`FRAME_BASE`).

use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};

pub const FILE_MAGIC: &[u8] = b"\x02\x01fmf.";
pub const HEADER_SIZE: u64 = 26;
pub const TRAILER_POINTER_AT: u64 = 9;
pub const TRAILER_HEADER_SIZE: usize = 9;
pub const FRAME_BASE: u64 = 26;
pub const DEFAULT_FRAME_CAP: u64 = 1024 * 1024 * 1024;
pub const DEFAULT_TOTAL_CAP: u64 = 4 * 1024 * 1024 * 1024;
const MAX_TRAILER_COMPRESSED: u64 = 64 * 1024 * 1024;
const MAX_TRAILER_DECOMPRESSED: usize = 64 * 1024 * 1024;
const MAX_SAVE_NAME_BYTES: usize = 4096;
const MAX_ENTRY_NAME_BYTES: usize = 256;
const MAX_DIRECTORY_ENTRIES: usize = 100_000;
const ENTRY_FIXED_TAIL_BYTES: usize = 40;

#[derive(Debug, Clone, Serialize)]
pub struct Fingerprint {
    pub file_size: u64,
    pub mtime_ns: i64,
    pub digest: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub extension: String,
    pub frame_offset: u64,
    pub compressed_size: u64,
    pub decompressed_size: u64,
    pub trailing_values: [u64; 2],
}

impl DirectoryEntry {
    pub fn is_section(&self) -> bool {
        matches!(self.extension.as_str(), ".dat" | ".cmt")
    }
}

#[derive(Debug, Clone)]
pub struct SaveFile {
    pub path: PathBuf,
    pub save_name: String,
    pub fingerprint: Fingerprint,
    pub trailer_offset: u64,
    pub entries: Vec<DirectoryEntry>,
    pub sections: HashMap<String, usize>,
}

impl SaveFile {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let mut file = File::open(&path)?;
        let metadata = file.metadata()?;
        let file_size = metadata.len();
        let mtime_ns = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_nanos() as i64)
            .unwrap_or(0);

        let mut header = [0u8; HEADER_SIZE as usize];
        file.read_exact(&mut header).map_err(|_| {
            Error::Corrupt(format!("{} is too short to be an FM save", path.display()))
        })?;
        if !header.starts_with(FILE_MAGIC) {
            return Err(Error::NotFmSave(path));
        }

        let trailer_relative = u64::from_le_bytes(header[9..17].try_into().unwrap());
        let trailer_offset = TRAILER_POINTER_AT + trailer_relative;
        if trailer_offset < HEADER_SIZE || trailer_offset + TRAILER_HEADER_SIZE as u64 >= file_size
        {
            return Err(Error::corrupt("the save directory is missing"));
        }
        let trailer_len = file_size - trailer_offset;
        if trailer_len - TRAILER_HEADER_SIZE as u64 > MAX_TRAILER_COMPRESSED {
            return Err(Error::corrupt("the save directory is implausibly large"));
        }

        file.seek(SeekFrom::Start(trailer_offset))?;
        let mut trailer = vec![0u8; trailer_len as usize];
        file.read_exact(&mut trailer)?;
        if !trailer.starts_with(FILE_MAGIC) {
            return Err(Error::corrupt("the save directory is damaged"));
        }

        let mut digest = Sha256::new();
        digest.update(header);
        digest.update(&trailer);
        let digest = format!("{:x}", digest.finalize());

        let payload = decompress_frame(
            &trailer[TRAILER_HEADER_SIZE..],
            None,
            MAX_TRAILER_DECOMPRESSED,
            "the save directory",
        )?;
        let (save_name, entries) = parse_directory(&payload)?;
        validate_entries(&entries, trailer_offset)?;

        let mut sections = HashMap::new();
        for (index, entry) in entries.iter().enumerate() {
            if entry.is_section() && sections.insert(entry.name.clone(), index).is_some() {
                return Err(Error::corrupt(format!(
                    "the save directory lists section {:?} twice",
                    entry.name
                )));
            }
        }

        Ok(Self {
            path,
            save_name,
            fingerprint: Fingerprint {
                file_size,
                mtime_ns,
                digest,
            },
            trailer_offset,
            entries,
            sections,
        })
    }

    pub fn section_entry(&self, name: &str) -> Result<&DirectoryEntry> {
        self.sections
            .get(name)
            .map(|index| &self.entries[*index])
            .ok_or_else(|| Error::corrupt(format!("save has no {name:?} section")))
    }

    pub fn read_section(&self, name: &str) -> Result<Vec<u8>> {
        let entry = self.section_entry(name)?.clone();
        if entry.decompressed_size > DEFAULT_FRAME_CAP {
            return Err(Error::corrupt(format!(
                "section {name:?} is larger than the per-frame cap"
            )));
        }
        let mut file = File::open(&self.path)?;
        file.seek(SeekFrom::Start(entry.frame_offset))?;
        let mut compressed = vec![0u8; entry.compressed_size as usize];
        file.read_exact(&mut compressed)?;
        decompress_frame(
            &compressed,
            Some(entry.decompressed_size as usize),
            DEFAULT_FRAME_CAP as usize,
            &format!("section {name:?}"),
        )
    }

    pub fn total_declared_bytes(&self) -> u64 {
        self.entries
            .iter()
            .map(|entry| entry.decompressed_size)
            .sum()
    }

    pub fn section_names(&self) -> Vec<&str> {
        let mut names: Vec<&str> = self
            .entries
            .iter()
            .filter(|entry| entry.is_section())
            .map(|entry| entry.name.as_str())
            .collect();
        names.sort_unstable();
        names
    }
}

fn read_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    bytes
        .get(offset..offset + 4)
        .map(|slice| u32::from_le_bytes(slice.try_into().unwrap()))
}

fn read_u64(bytes: &[u8], offset: usize) -> Option<u64> {
    bytes
        .get(offset..offset + 8)
        .map(|slice| u64::from_le_bytes(slice.try_into().unwrap()))
}

fn read_length_prefixed_string(
    bytes: &[u8],
    offset: usize,
    max_len: usize,
) -> Option<(String, usize)> {
    let len = read_u32(bytes, offset)? as usize;
    if len > max_len {
        return None;
    }
    let start = offset + 4;
    let end = start.checked_add(len)?;
    let text = std::str::from_utf8(bytes.get(start..end)?).ok()?;
    Some((text.to_owned(), end))
}

fn parse_directory(payload: &[u8]) -> Result<(String, Vec<DirectoryEntry>)> {
    let (save_name, mut cursor) = read_length_prefixed_string(payload, 0, MAX_SAVE_NAME_BYTES)
        .ok_or_else(|| Error::corrupt("the save directory name is unreadable"))?;
    cursor += 4; // a reserved u32
    let mut entries = Vec::new();
    while let Some((entry, next)) = parse_directory_entry(payload, cursor) {
        entries.push(entry);
        cursor = next;
        if entries.len() > MAX_DIRECTORY_ENTRIES {
            return Err(Error::corrupt("the save directory has too many entries"));
        }
    }
    if !entries.iter().any(DirectoryEntry::is_section) {
        return Err(Error::corrupt("the save directory lists no sections"));
    }
    entries.sort_by_key(|entry| entry.frame_offset);
    Ok((save_name, entries))
}

fn parse_directory_entry(payload: &[u8], cursor: usize) -> Option<(DirectoryEntry, usize)> {
    let name_len = read_u32(payload, cursor)? as usize;
    if !(1..=MAX_ENTRY_NAME_BYTES).contains(&name_len) {
        return None;
    }
    let extension_len_at = cursor.checked_add(4 + name_len)?;
    let tail_at = extension_len_at.checked_add(8)?;
    if tail_at.checked_add(ENTRY_FIXED_TAIL_BYTES)? > payload.len() {
        return None;
    }
    let name_bytes = payload.get(cursor + 4..extension_len_at)?;
    let extension_bytes = payload.get(extension_len_at + 4..tail_at)?;
    if read_u32(payload, extension_len_at)? != 4 {
        return None;
    }
    if !name_bytes
        .iter()
        .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        return None;
    }
    if extension_bytes.len() != 4
        || extension_bytes[0] != b'.'
        || !extension_bytes[1..].iter().all(u8::is_ascii_alphanumeric)
    {
        return None;
    }
    Some((
        DirectoryEntry {
            name: std::str::from_utf8(name_bytes).ok()?.to_owned(),
            extension: std::str::from_utf8(extension_bytes).ok()?.to_owned(),
            frame_offset: FRAME_BASE + read_u64(payload, tail_at)?,
            compressed_size: read_u64(payload, tail_at + 8)?,
            decompressed_size: read_u64(payload, tail_at + 16)?,
            trailing_values: [
                read_u64(payload, tail_at + 24)?,
                read_u64(payload, tail_at + 32)?,
            ],
        },
        tail_at + ENTRY_FIXED_TAIL_BYTES,
    ))
}

fn validate_entries(entries: &[DirectoryEntry], trailer_offset: u64) -> Result<()> {
    let mut previous_end = HEADER_SIZE;
    let mut total = 0u64;
    for entry in entries {
        if entry.compressed_size == 0
            || entry.frame_offset < previous_end
            || entry.frame_offset + entry.compressed_size > trailer_offset
        {
            return Err(Error::corrupt(format!(
                "directory entry {}{} points outside the frame area",
                entry.name, entry.extension
            )));
        }
        if entry.decompressed_size > DEFAULT_FRAME_CAP {
            return Err(Error::corrupt(format!(
                "directory entry {}{} is larger than the per-frame cap",
                entry.name, entry.extension
            )));
        }
        total = total.saturating_add(entry.decompressed_size);
        previous_end = entry.frame_offset + entry.compressed_size;
    }
    if total > DEFAULT_TOTAL_CAP {
        return Err(Error::corrupt(
            "the save declares more data than the total decompressed cap",
        ));
    }
    Ok(())
}

fn decompress_frame(
    compressed: &[u8],
    expected_size: Option<usize>,
    cap: usize,
    what: &str,
) -> Result<Vec<u8>> {
    let output_limit = expected_size.map_or(cap, |size| size.min(cap));
    let decoded = zstd::bulk::decompress(compressed, output_limit)
        .map_err(|error| Error::corrupt(format!("{what} could not be decompressed: {error}")))?;
    if decoded.len() > output_limit {
        return Err(Error::corrupt(format!(
            "{what} decompresses to more than {output_limit} bytes"
        )));
    }
    if let Some(expected) = expected_size {
        if decoded.len() != expected {
            return Err(Error::corrupt(format!(
                "{what} decompressed to {} bytes, expected {expected}",
                decoded.len()
            )));
        }
    }
    Ok(decoded)
}
