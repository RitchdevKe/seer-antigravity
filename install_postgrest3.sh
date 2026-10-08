
#!/bin/bash
sudo chmod 755 /home/ubuntu
sudo chmod 644 /home/ubuntu/*.sql
sudo chmod 755 /home/ubuntu/migrations
sudo chmod 644 /home/ubuntu/migrations/*.sql

echo "Creating Supabase roles..."
sudo -u postgres psql -d seer_db -c "CREATE ROLE anon nologin;"
sudo -u postgres psql -d postgres -c "CREATE ROLE anon nologin;"
sudo -u postgres psql -d seer_db -c "CREATE ROLE authenticated nologin;"
sudo -u postgres psql -d postgres -c "CREATE ROLE authenticated nologin;"
sudo -u postgres psql -d seer_db -c "CREATE ROLE service_role nologin;"
sudo -u postgres psql -d postgres -c "CREATE ROLE service_role nologin;"
sudo -u postgres psql -d seer_db -c "GRANT anon TO authenticator;"

echo "Running schema setup..."
sudo -u postgres psql -d seer_db -f /home/ubuntu/setup.sql
sudo -u postgres psql -d seer_db -f /home/ubuntu/supabase_schema.sql

echo "Running migrations..."
for file in /home/ubuntu/migrations/*.sql; do
    echo "Applying $file..."
    sudo -u postgres psql -d seer_db -f "$file"
done

echo "Granting permissions..."
sudo -u postgres psql -d seer_db -c "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;"
sudo -u postgres psql -d seer_db -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;"
sudo -u postgres psql -d seer_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;"
sudo -u postgres psql -d seer_db -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;"
sudo -u postgres psql -d seer_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;"

echo "Installing PostgREST..."
cd /home/ubuntu
wget https://github.com/PostgREST/postgrest/releases/download/v16.2/postgrest-v16.2-linux-static-x86-64.tar.xz -O postgrest.tar.xz
tar xJf postgrest.tar.xz
sudo mv postgrest /usr/local/bin/

echo "Creating PostgREST Config..."
cat << EOF > postgrest.conf
db-uri = "postgres://authenticator:seer_auth_password_123@localhost:5432/seer_db"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "212fb6ff0514cd82faf73bd46dd6f1cd07f8f6296b309e6e1d6e9266fb867325"
server-port = 3001
EOF

echo "Starting PostgREST via PM2..."
pm2 restart postgrest || pm2 start postgrest --name postgrest -- postgrest.conf
pm2 save

sudo systemctl reload nginx
