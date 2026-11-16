//! `yakap-api` — Yakap Bear prototype API server.
//!
//!   yakap-api            # run migrations (AUTO_MIGRATE) and serve on $PORT (default 8080)
//!   yakap-api migrate    # apply migrations and exit
//!   yakap-api seed       # apply migrations, rebuild the demo dataset, exit

use std::time::Duration;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;
use yakap_api::{AppState, MIGRATOR, build_app, config};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    config::load_env_files();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "yakap_api=info,tower_http=info".into()))
        .init();

    let cfg = config::Config::from_env()?;
    // Lazy pool: the server starts even if the database is down; requests then get 503s.
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(4))
        .connect_lazy(&cfg.database_url)
        .context("invalid DATABASE_URL")?;

    match std::env::args().nth(1).as_deref() {
        Some("migrate") => {
            MIGRATOR.run(&pool).await.context("migration failed")?;
            println!("Migrations applied.");
        }
        Some("seed") => {
            MIGRATOR.run(&pool).await.context("migration failed")?;
            let started = std::time::Instant::now();
            let summary = yakap_api::seed::reset_demo(&pool, &cfg, None)
                .await
                .map_err(|e| anyhow::anyhow!("seed failed: {} ({})", e.message, e.code))?;
            println!("Seeded demo data in {} ms. Demo clock: {} (7:45 PM Asia/Manila)", started.elapsed().as_millis(), summary.now);
            for (k, v) in &summary.counts {
                println!("  {k:<14} {v}");
            }
        }
        Some(other) if other != "serve" => anyhow::bail!("unknown command `{other}` (use serve | migrate | seed)"),
        _ => {
            if cfg.auto_migrate {
                if let Err(e) = MIGRATOR.run(&pool).await {
                    tracing::error!(error = %e, "could not run migrations at startup (database unreachable?)");
                }
            }
            let addr = std::net::SocketAddr::from(([0, 0, 0, 0], cfg.port));
            let listener = tokio::net::TcpListener::bind(addr).await.with_context(|| format!("cannot bind {addr}"))?;
            tracing::info!("yakap-api listening on http://{addr} (demo mode: {})", cfg.demo_mode);
            axum::serve(listener, build_app(AppState::new(pool, cfg)))
                .with_graceful_shutdown(async {
                    let _ = tokio::signal::ctrl_c().await;
                })
                .await?;
        }
    }
    Ok(())
}
