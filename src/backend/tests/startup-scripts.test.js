const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../../..");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "helmos-startup-scripts-"));
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
}

function runScript(scriptPath, { cwd, binSetup }) {
  const tempDir = makeTempDir();
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  binSetup({ tempDir, binDir });

  const markerPath = path.join(tempDir, "marker.txt");
  const result = spawnSync("/bin/bash", [scriptPath], {
    cwd,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      HELMOS_TEST_MARKER_PATH: markerPath,
    },
    encoding: "utf8",
  });

  return {
    ...result,
    markerPath,
    marker: fs.existsSync(markerPath) ? fs.readFileSync(markerPath, "utf8") : "",
  };
}

test("startup scripts resolve the backend working directory from the script path", () => {
  const backendScript = path.join(REPO_ROOT, "scripts/start_backend.sh");
  const gatewayScript = path.join(REPO_ROOT, "scripts/start_agent_gateway.sh");
  const litellmScript = path.join(REPO_ROOT, "scripts/start_litellm.sh");
  const externalCwd = "/";
  const expectedBackendCwd = path.join(REPO_ROOT, "src/backend");

  const backendResult = runScript(backendScript, {
    cwd: externalCwd,
    binSetup: ({ binDir }) => {
      writeExecutable(
        path.join(binDir, "npm"),
        [
          "#!/bin/bash",
          "printf 'cwd=%s\\ncmd=%s %s\\n' \"$PWD\" \"$1\" \"$2\" > \"$HELMOS_TEST_MARKER_PATH\"",
        ].join("\n"),
      );
    },
  });

  assert.equal(backendResult.status, 0, backendResult.stderr);
  assert.match(backendResult.marker, new RegExp(`cwd=${expectedBackendCwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(backendResult.marker, /cmd=run backend:dev/);

  const gatewayResult = runScript(gatewayScript, {
    cwd: externalCwd,
    binSetup: ({ binDir }) => {
      writeExecutable(
        path.join(binDir, "python3"),
        [
          "#!/bin/bash",
          "mkdir -p .venv/bin",
          "cat > .venv/bin/activate <<'EOF'",
          "#!/bin/bash",
          "export PATH=\"" + binDir + ":$PATH\"",
          "EOF",
        ].join("\n"),
      );
      writeExecutable(path.join(binDir, "pip"), "#!/bin/bash\nexit 0\n");
      writeExecutable(
        path.join(binDir, "uvicorn"),
        "#!/bin/bash\nprintf 'cwd=%s\\ncmd=%s %s\\n' \"$PWD\" \"$1\" \"$2\" > \"$HELMOS_TEST_MARKER_PATH\"\n",
      );
    },
  });

  assert.equal(gatewayResult.status, 0, gatewayResult.stderr);
  assert.match(gatewayResult.marker, new RegExp(`cwd=${expectedBackendCwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(gatewayResult.marker, /cmd=app\.main:app --reload/);

  const litellmResult = runScript(litellmScript, {
    cwd: externalCwd,
    binSetup: ({ binDir }) => {
      writeExecutable(
        path.join(binDir, "docker"),
        "#!/bin/bash\nprintf 'cwd=%s\\ncmd=%s %s %s\\n' \"$PWD\" \"$1\" \"$2\" \"$3\" > \"$HELMOS_TEST_MARKER_PATH\"\n",
      );
    },
  });

  assert.equal(litellmResult.status, 0, litellmResult.stderr);
  assert.match(litellmResult.marker, new RegExp(`cwd=${expectedBackendCwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(litellmResult.marker, /cmd=compose -f docker-compose\.litellm\.yml/);
});

test("backend startup script sources repo env files before launching the control plane", () => {
  const backendScript = path.join(REPO_ROOT, "scripts/start_backend.sh");
  const externalCwd = "/";

  const result = runScript(backendScript, {
    cwd: externalCwd,
    binSetup: ({ binDir }) => {
      writeExecutable(
        path.join(binDir, "npm"),
        [
          "#!/bin/bash",
          "printf 'DATABASE_URL=%s\\n' \"$DATABASE_URL\" > \"$HELMOS_TEST_MARKER_PATH\"",
        ].join("\n"),
      );
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.marker, /DATABASE_URL=postgresql:\/\/postgres@localhost:5432\/postgres\?schema=helmos/);
});
