# Yakap Bear API — container image for Render / Fly.io / Railway.
#   docker build -t yakap-api backend
#   docker run -p 8080:8080 --env-file .env yakap-api
FROM rust:1-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY migrations ./migrations
COPY src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/release/yakap-api /usr/local/bin/yakap-api
ENV PORT=8080 \
    AUTO_MIGRATE=true \
    RUST_LOG=yakap_api=info,tower_http=info
EXPOSE 8080
CMD ["yakap-api"]
