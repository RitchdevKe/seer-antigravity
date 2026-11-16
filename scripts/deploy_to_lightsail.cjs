const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const keyPath = 'C:\\Users\\USER\\Downloads\\LightsailDefaultKey-ap-south-1.pem';
const host = 'ubuntu@43.204.6.228';
const remoteDir = '/home/ubuntu/seer_app';
const projectDir = 'c:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY';

console.log("=== 0. Syncing production Save-to-Codebase rules & day files ===");
const localRulesPath = path.join(projectDir, 'data', 'opw_rules.json');
const tempRemoteRulesPath = path.join(projectDir, 'data', 'opw_rules.remote.tmp.json');

if (process.env.SKIP_SYNC !== '1') {
  try {
    const remoteRaw = execSync(`ssh -i "${keyPath}" -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=10 "${host}" "cat ${remoteDir}/data/opw_rules.json 2>/dev/null"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 15000 });
    if (remoteRaw && remoteRaw.trim().startsWith('{')) {
    const remoteJson = JSON.parse(remoteRaw) || { rules: {} };
    let localJson = { rules: {} };
    if (fs.existsSync(localRulesPath)) {
      try {
        localJson = JSON.parse(fs.readFileSync(localRulesPath, 'utf-8')) || { rules: {} };
      } catch (e) {}
    }
    if (!localJson.rules) localJson.rules = {};
    const remoteRules = remoteJson.rules || {};
    let dayFilesUpdatedFromRemote = false;

    const dayFileMap = {
      monday: 'mondayopw.tsx',
      tuesday: 'opwtuesday.tsx',
      wednesday: 'opwwednesday.tsx',
      thursday: 'opwthursday.tsx',
      friday: 'opwfriday.tsx',
      saturday: 'opwsaturday.tsx',
      sunday: 'opwsunday.tsx',
    };

    for (const [day, rEntry] of Object.entries(remoteRules)) {
      const lEntry = localJson.rules[day];
      const rTime = Date.parse(rEntry?.savedAt || '') || 0;
      const lTime = Date.parse(lEntry?.savedAt || '') || 0;
      if (!lEntry || rTime > lTime) {
        localJson.rules[day] = {
          savedAt: rEntry.savedAt || new Date().toISOString(),
          categories: {
            ...(lEntry?.categories || {}),
            ...(rEntry.categories || {})
          }
        };
        if (rTime > lTime && dayFileMap[day]) {
          try {
            execSync(`scp -i "${keyPath}" -o StrictHostKeyChecking=no "${host}:${remoteDir}/src/${dayFileMap[day]}" "${path.join(projectDir, 'src', dayFileMap[day])}"`, { stdio: 'pipe' });
            dayFilesUpdatedFromRemote = true;
            console.log(`Synced newer Save-to-Codebase day file from production: src/${dayFileMap[day]}`);
          } catch (e) {}
        }
      }
    }
    const DELETED_TRIGGERS = [
      "Underdgog GS> Mfav gs with >=0.3",
      "Match belongs to England: Non League Premier",
      "Mfav GS> Underdog GS with >= 0.3",
      "Match belongs to European countries league 3 (III).",
      "Match belongs to italy series C",
      "Match belongs to Italy: Serie C",
      "Match belongs to Ireland Leagues",
      "High Conviction Defense + Attack Dominance",
      "Odds difference >= 1.0",
      "Odds difference >= 0.50",
      "Mfav L10 > Underdog L10",
      "Mfav L10 >= 6",
      "1X2 Rating =>4 and <=6",
      "Mfav TS >= 2.0 and Underdog TS < 0.7",
      "Match belongs Spain: Segunda División",
      "Match belongs Spain: Tercera División",
      "Underdog odds <= 2.70",
      "Underdog and draw odds >3.0 but und odds < draw odds",
      "Match belongs to Turkey leagues",
      "Both teams GA > GS",
      "PHA TIE",
      "PHA is a tie between outcomes",
      "Both team GS => 1.8+Mfav GA=Und GA (+-0.2)",
      "Match belongs to big 5 league",
      "Match belongs to Iraq leagues",
      "Match belongs to African local leagues",
      "Match belongs to USA-USL Championship",
      "Match belongs to Slovenia leagues",
      "Match belong to israel leagues",
      "Match belongs to Argentina (no league)",
      "Match belongs to Iraq leagues+Seer score on draw >= 35%",
      "Seer score on draw >= 35%",
      "Match belongs to Chile: Leagues",
      "Match belongs to Chile leagues",
      "Match belongs to England leagues",
      "Match belongs to England",
      "Match belong to England Amateur",
      "Match belongs to Spain leagues",
      "Match belongs to spain leagues",
      "Match belongs to Spain",
      "Match belong to israel leagues",
      "Match belongs to Israel leagues",
      "Match belongs to Vietnam leagues",
      "Match belongs to Egyptian leagues",
      "Match belongs to kazakhstan leagues",
      "Match belong to Bolivian leagues",
      "Match belongs to Ukraine leagues",
      "Match belong to Thailand leagues",
      "Match belongs to Iceland leagues",
      "Match belongs to Slovakia leagues",
      "Match belongs to El Salvador:Leagues",
      "Match belongs to El Salvador leagues",
      "Match belongs to Philippines leagues",
      "Match belongs to Latvia leagues",
      "Match belongs to Hong Kong leagues",
      "Match belongs to Estonia Leagues",
      "Match belongs to Estonia Leagues +Youth League (U21,U20,U19)",
      "Match belongs to Costa Rica Leagues",
      "Match belongs to Kosovo leagues",
      "Match belongs to Non European major leagues",
      "Match belongs to Argentina",
      "Match belongs to France",
      "Match belongs to Australia",
      "Match belongs to Wales",
      "Match belongs to Denmark",
      "Match belongs to Croatia",
      "Match belongs to Slovenia",
      "Match belongs to Bahrain",
      "Match belongs to Bangladesh",
      "Match belongs to Czech Republic",
      "Match belong to norway 3rd division",
      "Match belongs to Northern ireland",
      "Odds for underdog >= 2.80 to 3.0+Match belongs to Northern ireland",
      "Match belongs to Hungary teams",
      "Match belongs to Engalnd Amateur :National league",
    ];
    const UPDATED_TRIGGERS = {
      "L10: Mfav Wins+ Draws = Underdog wins +Draws": 15,
      "L10: Mfav Wins+ Draws > Underdog wins +Draws": 20,
      "L10: Mfav Wins+ Draws < Underdog wins +Draws": -15,
      "1X2 pred supports the underdog": -15,
    };
    if (localJson.rules) {
      for (const d of Object.values(localJson.rules)) {
        if (d && d.categories) {
          for (const [catName, c] of Object.entries(d.categories)) {
            const isUpsets = catName.includes('upset');
            if (c && Array.isArray(c.rules)) {
              c.rules = c.rules.filter(r => !DELETED_TRIGGERS.includes(r.description));
              for (const r of c.rules) {
                if (!isUpsets && UPDATED_TRIGGERS[r.description] !== undefined) {
                  r.points = UPDATED_TRIGGERS[r.description];
                }
              }
            }
          }
        }
      }
    }

    fs.writeFileSync(localRulesPath, JSON.stringify(localJson, null, 2), 'utf-8');
    if (fs.existsSync(tempRemoteRulesPath)) {
      try { fs.unlinkSync(tempRemoteRulesPath); } catch (e) {}
    }
    if (dayFilesUpdatedFromRemote) {
      console.log("Rebuilding frontend bundle with synced production day files...");
      execSync(`npm run build`, { stdio: 'inherit', cwd: projectDir });
    }
  }
} catch (syncErr) {
  if (fs.existsSync(tempRemoteRulesPath)) {
    try { fs.unlinkSync(tempRemoteRulesPath); } catch (e) {}
  }
  console.log("Notice: Could not fetch remote opw_rules.json (proceeding with local copy).");
}
}

console.log("=== 1. Creating deployment tarball ===");
const tarFile = path.join(projectDir, 'deploy_bundle.tar.gz');
if (fs.existsSync(tarFile)) {
  fs.unlinkSync(tarFile);
}
execSync(`tar -czf deploy_bundle.tar.gz dist server.ts src scripts`, { stdio: 'inherit', cwd: projectDir });

console.log("=== 2. Uploading tarball and rules to Lightsail ===");
const sshOpts = `-i "${keyPath}" -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=30`;

function runCmdWithRetry(cmd, maxRetries = 4, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      execSync(cmd, { stdio: 'inherit' });
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(`[Retry ${attempt}/${maxRetries}] Command failed, waiting ${delayMs / 1000}s: ${cmd.slice(0, 80)}...`);
      execSync(`node -e "setTimeout(() => {}, ${delayMs})"`);
    }
  }
}

runCmdWithRetry(`scp ${sshOpts} -B "./deploy_bundle.tar.gz" "${host}:${remoteDir}/deploy_bundle.tar.gz"`);
runCmdWithRetry(`ssh ${sshOpts} -o BatchMode=yes ${host} "mkdir -p ${remoteDir}/data"`);
if (process.env.SKIP_SYNC !== '1') {
  try {
    const remoteRaw = execSync(`ssh ${sshOpts} "${host}" "cat ${remoteDir}/data/opw_rules.json 2>/dev/null"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 15000 });
    if (remoteRaw && remoteRaw.trim().startsWith('{')) {
      const remoteJson = JSON.parse(remoteRaw);
      let localJson = fs.existsSync(localRulesPath) ? JSON.parse(fs.readFileSync(localRulesPath, 'utf-8')) : { rules: {} };
      if (!localJson.rules) localJson.rules = {};
      for (const [day, rEntry] of Object.entries(remoteJson.rules || {})) {
        const lEntry = localJson.rules[day];
        const rTime = Date.parse(rEntry?.savedAt || '') || 0;
        const lTime = Date.parse(lEntry?.savedAt || '') || 0;
        if (!lEntry || rTime > lTime) {
          localJson.rules[day] = rEntry;
        }
      }
      fs.writeFileSync(localRulesPath, JSON.stringify(localJson, null, 2), 'utf-8');
    }
  } catch (_) {}
}
runCmdWithRetry(`scp ${sshOpts} -B "./data/opw_rules.json" "${host}:${remoteDir}/data/opw_rules.json"`);

const localCookiesPath = path.join(projectDir, 'nerdy_cookies.json');
if (fs.existsSync(localCookiesPath)) {
  console.log("Uploading authenticated nerdy_cookies.json to Lightsail...");
  runCmdWithRetry(`scp ${sshOpts} -B "./nerdy_cookies.json" "${host}:${remoteDir}/nerdy_cookies.json"`);
}

console.log("=== 3. Extracting tarball and restarting services on Lightsail ===");
const remoteScript = `cd ${remoteDir} && rm -rf dist/assets/* && tar -xzf deploy_bundle.tar.gz --overwrite && rm -f deploy_bundle.tar.gz && chmod -R u+w ${remoteDir} && node scripts/sync_opw_rules_to_rds.cjs && NODE_ENV=production pm2 restart seer_backend --update-env && sudo systemctl reload nginx`;
runCmdWithRetry(`ssh ${sshOpts} -o BatchMode=yes ${host} "${remoteScript}"`);

if (fs.existsSync(tarFile)) {
  fs.unlinkSync(tarFile);
}

console.log("=== Deployment to Lightsail Complete! ===");
