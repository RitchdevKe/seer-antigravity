
#!/bin/bash
sudo chmod 755 /home/ubuntu
sudo chmod 644 /home/ubuntu/*.sql
sudo chmod 755 /home/ubuntu/migrations
sudo chmod 644 /home/ubuntu/migrations/*.sql

echo "Running schema setup..."
sudo -u postgres psql -d seer_db -f /home/ubuntu/setup.sql
sudo -u postgres psql -d seer_db -f /home/ubuntu/supabase_schema.sql

echo "Running migrations..."
for file in /home/ubuntu/migrations/*.sql; do
    echo "Applying $file..."
    sudo -u postgres psql -d seer_db -f "$file"
done

echo "Installing PostgREST..."
cd /home/ubuntu
wget https://github.com/PostgREST/postgrest/releases/download/v12.2.0/postgrest-v12.2.0-linux-x64.tar.xz -O postgrest.tar.xz
tar xJf postgrest.tar.xz
sudo mv postgrest /usr/local/bin/

echo "Starting PostgREST via PM2..."
pm2 start postgrest --name postgrest -- postgrest.conf
pm2 save

sudo systemctl reload nginx
