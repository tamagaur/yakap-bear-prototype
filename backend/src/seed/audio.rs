//! A short, gentle chime generated as a WAV file. Used as the clearly
//! labelled "sample" reminder so a bear has something to play before the
//! family records a real voice message. It is NOT presented as a recording.

pub const CHIME_DURATION_SEC: f64 = 0.32 * 4.0 + 0.9;

pub fn chime_wav() -> Vec<u8> {
    let sample_rate: u32 = 16_000;
    let notes = [523.25_f64, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    let note_len = 0.32;
    let tail = 0.9;
    let total = (sample_rate as f64 * (note_len * notes.len() as f64 + tail)) as usize;
    let mut pcm = vec![0f64; total];
    for (i, freq) in notes.iter().enumerate() {
        let start = (i as f64 * note_len * sample_rate as f64) as usize;
        let len = ((note_len + tail) * sample_rate as f64) as usize;
        for n in 0..len {
            if start + n >= total {
                break;
            }
            let t = n as f64 / sample_rate as f64;
            let env = (t / 0.01).min(1.0) * (-t * 4.2).exp();
            let tau = std::f64::consts::TAU;
            let v = (tau * freq * t).sin() * 0.55 + (tau * freq * 2.0 * t).sin() * 0.18 + (tau * freq * 3.0 * t).sin() * 0.07;
            pcm[start + n] += v * env * 9000.0;
        }
    }
    let data_bytes = (total * 2) as u32;
    let mut out = Vec::with_capacity(44 + data_bytes as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_bytes).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&(sample_rate * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_bytes.to_le_bytes());
    for s in pcm {
        out.extend_from_slice(&(s.clamp(-32767.0, 32767.0) as i16).to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    #[test]
    fn produces_a_valid_wav_header() {
        let wav = super::chime_wav();
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert!(wav.len() > 44 + 16_000);
    }
}
