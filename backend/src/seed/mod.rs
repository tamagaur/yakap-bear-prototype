//! Demo data and reset (tasks D11, B13, S9). Fictional data only.

pub mod audio;
pub mod demo_data;
pub mod history;
pub mod reset;

pub use reset::reset_demo;

/// Demo-only shared password for every seeded account (documented in README).
pub const DEMO_PASSWORD: &str = "yakap-demo-2026";
