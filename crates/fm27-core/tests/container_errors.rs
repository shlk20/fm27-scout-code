use std::io::Write;

use fm27_core::container::SaveFile;

#[test]
fn rejects_non_fm_files() {
    let mut file = tempfile::NamedTempFile::new().unwrap();
    file.write_all(b"not a football manager save").unwrap();
    let error = SaveFile::open(file.path()).unwrap_err();
    assert!(matches!(error, fm27_core::Error::NotFmSave(_)));
}

#[test]
fn rejects_truncated_headers() {
    let mut file = tempfile::NamedTempFile::new().unwrap();
    file.write_all(b"\x02\x01fmf.").unwrap();
    let error = SaveFile::open(file.path()).unwrap_err();
    assert!(matches!(error, fm27_core::Error::Corrupt(_)));
}
