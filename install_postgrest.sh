
#!/bin/bash
echo "Creating database and roles..."
sudo -u postgres psql -c "CREATE DATABASE seer_db;"
sudo -u postgres psql -d seer_db -c "CREATE ROLE web_anon nologin;"
sudo -u postgres psql -d seer_db -c "CREATE ROLE authenticator noinherit login password 'seer_auth_password_123';"
sudo -u postgres psql -d seer_db -c "GRANT web_anon TO authenticator;"

echo "Running schema setup..."
sudo -u postgres psql -d seer_db -f setup.sql
sudo -u postgres psql -d seer_db -f supabase_schema.sql

echo "Running migrations..."
for file in migrations/*.sql; do
    echo "Applying $file..."
    sudo -u postgres psql -d seer_db -f "$file"
done

echo "Granting permissions to web_anon..."
sudo -u postgres psql -d seer_db -c "GRANT USAGE ON SCHEMA public TO web_anon;"
sudo -u postgres psql -d seer_db -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO web_anon;"
sudo -u postgres psql -d seer_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_anon;"
sudo -u postgres psql -d seer_db -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;"
sudo -u postgres psql -d seer_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO web_anon;"

echo "Installing PostgREST..."
cd ~
wget https://github.com/PostgREST/postgrest/releases/download/v12.2.0/postgrest-v12.2.0-linux-x64-static.tar.xz
tar xJf postgrest-v12.2.0-linux-x64-static.tar.xz
sudo mv postgrest /usr/local/bin/

echo "Creating PostgREST Config..."
cat << EOF > postgrest.conf
db-uri = "postgres://authenticator:seer_auth_password_123@localhost:5432/seer_db"
db-schemas = "public"
db-anon-role = "web_anon"
jwt-secret = "212fb6ff0514cd82faf73bd46dd6f1cd07f8f6296b309e6e1d6e9266fb867325"
server-port = 3001
EOF

echo "Starting PostgREST via PM2..."
npm install -g pm2
pm2 start postgrest --name postgrest -- postgrest.conf
pm2 save

echo "Updating Nginx..."
cat << EOF | sudo tee /etc/nginx/sites-available/seer
server {
    server_name seer.myshule.ke;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /rest/v1/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/seer.myshule.ke/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/seer.myshule.ke/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if (\$host = seer.myshule.ke) {
        return 301 https://\$host\$request_uri;
    } # managed by Certbot

    listen 80;
    server_name seer.myshule.ke;
    return 404; # managed by Certbot
}
EOF
sudo systemctl reload nginx

