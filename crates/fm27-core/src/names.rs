//! The three name pools stored in `game_db`: first names, surnames and common names.

use crate::error::{Error, Result};
use crate::layout::{NAME_POOL_PREFIX, NAME_POOL_SIGNATURE, read_u32};

const MAX_NAME_BYTES: usize = 1024;
const MAX_SIGNATURE_SCALE: u32 = 1024;

#[derive(Debug, Clone, Default)]
pub struct PoolIndex {
    /// Offset of each entry's u32 length word.
    pub offsets: Vec<usize>,
    pub count: usize,
}

impl PoolIndex {
    pub fn name_at(&self, bytes: &[u8], index: u32) -> Option<String> {
        if index == u32::MAX || index as usize >= self.count {
            return None;
        }
        let offset = *self.offsets.get(index as usize)?;
        let length = read_u32(bytes, offset)? as usize;
        if length == 0 {
            return None;
        }
        let start = offset + 4;
        let text = bytes.get(start..start + length)?;
        std::str::from_utf8(text).ok().map(str::to_owned)
    }
}

#[derive(Debug, Clone, Default)]
pub struct NamePools {
    pub first_names: PoolIndex,
    pub surnames: PoolIndex,
    pub common_names: PoolIndex,
    pub end_offset: usize,
}

impl NamePools {
    pub fn locate(game_db: &[u8]) -> Result<Self> {
        let mut found = None;
        let mut first_error = None;

        for at in signature_candidates(game_db) {
            match Self::read_after_signature(game_db, at + NAME_POOL_SIGNATURE.len()) {
                Ok(pools) => {
                    if found.is_some() {
                        return Err(Error::parse(
                            "name pools are ambiguous: more than one valid signature",
                        ));
                    }
                    found = Some(pools);
                }
                Err(error) => {
                    if first_error.is_none() {
                        first_error = Some(error);
                    }
                }
            }
        }

        found
            .ok_or_else(|| first_error.unwrap_or_else(|| Error::parse("name pools were not found")))
    }

    fn read_after_signature(game_db: &[u8], mut cursor: usize) -> Result<Self> {
        let first_names = read_pool(game_db, &mut cursor, "first names")?;
        let surnames = read_pool(game_db, &mut cursor, "surnames")?;
        let common_names = read_pool(game_db, &mut cursor, "common names")?;
        Ok(Self {
            first_names,
            surnames,
            common_names,
            end_offset: cursor,
        })
    }

    pub fn resolve_common(&self, bytes: &[u8], id: u32) -> Option<String> {
        self.common_names
            .name_at(bytes, id)
            .or_else(|| self.first_names.name_at(bytes, id))
            .or_else(|| self.surnames.name_at(bytes, id))
    }
}

fn signature_candidates(game_db: &[u8]) -> Vec<usize> {
    let mut candidates = Vec::new();
    let mut start = 0usize;
    while let Some(relative) = game_db[start..]
        .windows(NAME_POOL_PREFIX.len())
        .position(|window| window == NAME_POOL_PREFIX)
    {
        let at = start + relative;
        start = at + 1;
        if at + NAME_POOL_SIGNATURE.len() > game_db.len() {
            continue;
        }
        if signature_matches(&game_db[at..at + NAME_POOL_SIGNATURE.len()]) {
            candidates.push(at);
        }
    }
    candidates
}

fn signature_matches(bytes: &[u8]) -> bool {
    if bytes == NAME_POOL_SIGNATURE {
        return true;
    }
    let Some(words) = (0..6)
        .map(|index| read_u32(bytes, index * 4))
        .collect::<Option<Vec<_>>>()
    else {
        return false;
    };
    let expected: [u32; 6] = [46421, 0, 1024, 256, 2048, 0];
    if words[0] != expected[0] || words[5] != expected[5] {
        return false;
    }
    if words[3] == 0 || words[3] % expected[3] != 0 {
        return false;
    }
    let scale = words[3] / expected[3];
    if scale == 0 || scale > MAX_SIGNATURE_SCALE {
        return false;
    }
    words[2] == expected[2] * scale
        && words[4] == expected[4] * scale
        && (words[1] == 0 || (words[1] & 0xFFFF_FF00) == 0)
}

fn read_pool(game_db: &[u8], cursor: &mut usize, label: &str) -> Result<PoolIndex> {
    let count = read_u32(game_db, *cursor)
        .ok_or_else(|| Error::parse(format!("{label} pool count is outside the section")))?
        as usize;
    let mut position = *cursor + 4;
    if position > game_db.len() {
        return Err(Error::parse(format!("{label} pool runs past the section")));
    }
    if count.saturating_mul(8) > game_db.len().saturating_sub(position) {
        return Err(Error::parse(format!(
            "{label} pool claims {count} entries, more than the section can hold"
        )));
    }
    let mut offsets = Vec::with_capacity(count);
    for index in 0..count {
        let entry_id = read_u32(game_db, position)
            .ok_or_else(|| Error::parse(format!("{label} pool runs past the section")))?;
        let name_length = read_u32(game_db, position + 4)
            .ok_or_else(|| Error::parse(format!("{label} pool runs past the section")))?
            as usize;
        if entry_id as usize != index {
            return Err(Error::parse(format!(
                "{label} pool entry {index} has id {entry_id}"
            )));
        }
        if name_length > MAX_NAME_BYTES {
            return Err(Error::parse(format!(
                "{label} pool entry {index} is {name_length} bytes, over the {MAX_NAME_BYTES} cap"
            )));
        }
        offsets.push(position + 4);
        position = position
            .checked_add(8 + name_length)
            .ok_or_else(|| Error::parse(format!("{label} pool overflows")))?;
        if position > game_db.len() {
            return Err(Error::parse(format!("{label} pool runs past the section")));
        }
    }
    *cursor = position;
    Ok(PoolIndex { offsets, count })
}
