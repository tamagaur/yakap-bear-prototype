use anyhow::{Context, bail};

/// Runtime configuration (environment variables; see `.env.example`).
#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub session_secret: String,
    /// Enables demo clock controls, demo reset and simulator pairing.
    pub demo_mode: bool,
    /// Device token given to seeded bears (BEAR-0001…).
    pub bear_device_key: String,
    pub port: u16,
    /// Adds `Secure` to session cookies (set true behind HTTPS).
    pub cookie_secure: bool,
    /// Run pending migrations on startup.
    pub auto_migrate: bool,
}

fn flag(name: &str, default: bool) -> bool {
    std::env::var(name)
        .map(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(default)
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .context("DATABASE_URL is not set (see .env.example)")?;
        let session_secret = std::env::var("SESSION_SECRET").unwrap_or_default();
        if session_secret.len() < 32 {
            bail!("SESSION_SECRET must be at least 32 characters (see .env.example)");
        }
        let port = std::env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8080);
        Ok(Self {
            database_url,
            session_secret,
            demo_mode: flag("DEMO_MODE", false),
            bear_device_key: std::env::var("BEAR_DEVICE_KEY")
                .ok()
                .filter(|k| !k.is_empty())
                .unwrap_or_else(|| "demo-bear-key".into()),
            port,
            cookie_secure: flag("COOKIE_SECURE", false),
            auto_migrate: flag("AUTO_MIGRATE", true),
        })
    }
}

/// Loads `.env` from the current folder and the repository root (`../.env`)
/// without overriding variables that are already set.
pub fn load_env_files() {
    let _ = dotenvy::from_filename(".env");
    let _ = dotenvy::from_filename("../.env");
}
