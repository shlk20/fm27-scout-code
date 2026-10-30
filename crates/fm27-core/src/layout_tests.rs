#[cfg(test)]
mod tests {
    use chrono::{Datelike, NaiveDate};

    use crate::layout::{decode_date, scale_attribute};

    #[test]
    fn date_round_trips_day_of_year() {
        let mut bytes = [0u8; 4];
        let day = NaiveDate::from_ymd_opt(2026, 7, 13).unwrap();
        let doy = day.ordinal() as u16;
        let packed = doy;
        bytes[..2].copy_from_slice(&packed.to_le_bytes());
        bytes[2..].copy_from_slice(&2026u16.to_le_bytes());
        assert_eq!(decode_date(&bytes, 0), Some(day));
    }

    #[test]
    fn date_rejects_bad_years_and_days() {
        let mut bytes = [0u8; 4];
        bytes[..2].copy_from_slice(&1u16.to_le_bytes());
        bytes[2..].copy_from_slice(&1899u16.to_le_bytes());
        assert_eq!(decode_date(&bytes, 0), None);
        bytes[2..].copy_from_slice(&2026u16.to_le_bytes());
        bytes[..2].copy_from_slice(&400u16.to_le_bytes());
        assert_eq!(decode_date(&bytes, 0), None);
    }

    #[test]
    fn attributes_use_the_verified_scale() {
        assert_eq!(scale_attribute(0), 1);
        assert_eq!(scale_attribute(1), 1);
        assert_eq!(scale_attribute(50), 10);
        assert_eq!(scale_attribute(75), 15);
        assert_eq!(scale_attribute(100), 20);
    }
}
