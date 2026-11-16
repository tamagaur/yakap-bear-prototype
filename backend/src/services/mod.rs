//! Database-backed business services. Pure rules live in `crate::dose_rules`.

pub mod alerts;
pub mod audit;
pub mod bear;
pub mod clinic;
pub mod clock;
pub mod consent;
pub mod convert;
pub mod corrections;
pub mod demo;
pub mod dose_engine;
pub mod hold_filter;
pub mod insights;
pub mod patients;
pub mod sync;
