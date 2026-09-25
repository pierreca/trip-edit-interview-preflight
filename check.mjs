import { lstatSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import pg from "pg";

const repo = "/app";
const notes = [];
let failure;

// Where the repository lives on the host, as far as the container can tell:
// the shell's working directory (unset in PowerShell and cmd) and the source of
// the /app mount.
function hostLocation() {
  const line = readFileSync("/proc/self/mountinfo", "utf8")
    .split("\n")
    .find((l) => l.split(" ")[4] === repo);
  const [before = "", after = ""] = (line ?? "").split(" - ");
  const [fsType = "", source = ""] = after.split(" ");
  return { hostPwd: process.env.HOST_PWD ?? "", mountRoot: before.split(" ")[3] ?? "", fsType, source };
}

// A clone on a Windows drive (C:\..., or /mnt/c/... from a WSL2 shell) is
// shared into Docker through a network filesystem that doesn't pass on file
// change events, so edits never reach the app's watchers.
function checkWindowsDrive() {
  const { hostPwd, mountRoot, fsType, source } = hostLocation();
  const onWindowsDrive =
    /^\/mnt\/[a-z]\//i.test(hostPwd) ||
    /^\/[a-z]\//i.test(hostPwd) ||
    /\/mnt\/host\/[a-z]\//i.test(`${mountRoot} ${source}`) ||
    /^[a-z]:\\/i.test(source) ||
    /drvfs/i.test(fsType);
  if (onWindowsDrive) {
    failure =
      "this repository is on a Windows drive, so edits won't reach the app. " +
      "Clone it inside WSL2 (for example under ~/code) and run the check again from there.";
  }
  const mount = fsType ? `mounted from ${source} ${mountRoot} (${fsType})` : "mount not found";
  return `folder ${hostPwd || "(no shell path)"}, ${mount}`;
}

// On Linux, and inside WSL2, the containers run as root and whatever they write
// into the folder (migrations, generated code) belongs to root on the host.
function checkOwnership() {
  const probe = `${repo}/.probe`;
  writeFileSync(probe, "");
  const written = statSync(probe).uid;
  rmSync(probe);
  const cloned = statSync(`${repo}/package.json`).uid;
  if (written !== cloned) {
    notes.push(
      `files the containers create will belong to root (uid ${written}), not to you (uid ${cloned}). ` +
        'It works; `sudo chown -R "$(id -u):$(id -g)" .` gives them back when needed.',
    );
  }
}

function checkCheckout() {
  if (readFileSync(`${repo}/checks/line-endings.txt`, "utf8").includes("\r")) {
    notes.push("git converted files to Windows line endings. Cloning inside WSL2 avoids it.");
  }
  if (!lstatSync(`${repo}/checks/link`).isSymbolicLink()) {
    notes.push("git checked out a symbolic link as a plain file. Cloning inside WSL2 avoids it.");
  }
}

async function databaseVersion() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const { rows } = await client.query("select version()");
    return rows[0].version.split(" (")[0];
  } finally {
    await client.end().catch(() => {});
  }
}

let location = "unknown";
try {
  location = checkWindowsDrive();
  checkOwnership();
  checkCheckout();
  const version = await databaseVersion();
  if (!failure) {
    console.log(`\nSetup works: Node ${process.version} reached ${version}.`);
    for (const note of notes) console.log(`Note: ${note}`);
    if (notes.length) console.log("Please mention the notes above when you reply.");
  }
} catch (error) {
  failure ??= error.message;
}
if (failure) {
  console.error(`\nSetup check failed: ${failure}`);
  process.exitCode = 1;
}
console.log(`(${location})\n`);
