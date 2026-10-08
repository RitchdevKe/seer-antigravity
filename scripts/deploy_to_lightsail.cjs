const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const keyPath = 'C:\\Users\\USER\\Downloads\\LightsailDefaultKey-ap-south-1.pem';
const host = 'ubuntu@43.204.6.228';
const remoteDir = '/home/ubuntu/seer_app';
const projectDir = 'c:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY';

console.log("=== 1. Creating deployment tarball ===");
const tarFile = path.join(projectDir, 'deploy_bundle.tar.gz');
if (fs.existsSync(tarFile)) {
  fs.unlinkSync(tarFile);
}
execSync(`tar -czf deploy_bundle.tar.gz dist server.ts src`, { stdio: 'inherit', cwd: projectDir });

console.log("=== 2. Uploading tarball to Lightsail ===");
execSync(`scp -i "${keyPath}" -o StrictHostKeyChecking=no "${tarFile}" "${host}:${remoteDir}/deploy_bundle.tar.gz"`, { stdio: 'inherit' });

console.log("=== 3. Extracting tarball and restarting services on Lightsail ===");
const remoteScript = `cd ${remoteDir} && chmod -R u+w ${remoteDir} && rm -rf dist/assets/* && tar -xzf deploy_bundle.tar.gz --overwrite && rm -f deploy_bundle.tar.gz && pm2 restart seer_backend --update-env && sudo systemctl reload nginx`;
execSync(`ssh -i "${keyPath}" -o StrictHostKeyChecking=no ${host} "${remoteScript}"`, { stdio: 'inherit' });

if (fs.existsSync(tarFile)) {
  fs.unlinkSync(tarFile);
}

console.log("=== Deployment to Lightsail Complete! ===");
