const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

let S3Client = null;
let PutObjectCommand = null;
let DeleteObjectCommand = null;
let GetObjectCommand = null;

try {
  ({ S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3"));
} catch {
  S3Client = null;
}

class LocalFileStorageAdapter {
  constructor({ rootPath }) {
    this.rootPath = rootPath;
    this.provider = "LOCAL";
  }

  async storeObject({ objectKey, body, mimeType }) {
    const absolutePath = path.join(this.rootPath, objectKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, body);

    return {
      objectKey,
      provider: this.provider,
      mimeType,
    };
  }

  async readObject(objectKey) {
    return fs.readFile(path.join(this.rootPath, objectKey));
  }

  async deleteObject(objectKey) {
    try {
      await fs.unlink(path.join(this.rootPath, objectKey));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

class S3FileStorageAdapter {
  constructor({ bucketName, region, accessKeyId, secretAccessKey }) {
    if (!S3Client) {
      throw new Error("S3 storage support requires @aws-sdk/client-s3 to be installed.");
    }
    this.bucketName = bucketName;
    this.provider = "S3";
    this.client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  async storeObject({ objectKey, body, mimeType }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: body,
        ContentType: mimeType,
      }),
    );

    return {
      objectKey,
      provider: this.provider,
      mimeType,
    };
  }

  async readObject(objectKey) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }),
    );

    return Buffer.from(await response.Body.transformToByteArray());
  }

  async deleteObject(objectKey) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }),
    );
  }
}

class FileStorageService {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async storeFile({ knowledgeBaseId, fileId, originalFilename, mimeType, body }) {
    const extension = path.extname(originalFilename).toLowerCase();
    const safeBasename = path.basename(originalFilename, extension).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "upload";
    const objectKey = path.posix.join(
      knowledgeBaseId,
      `${fileId}-${safeBasename}${extension}`,
    );

    return this.adapter.storeObject({
      objectKey,
      body,
      mimeType,
    });
  }

  async readFile(objectKey) {
    return this.adapter.readObject(objectKey);
  }

  async deleteFile(objectKey) {
    return this.adapter.deleteObject(objectKey);
  }
}

function createFileStorageService(config) {
  if (config.storageMode === "s3") {
    return new FileStorageService(
      new S3FileStorageAdapter({
        bucketName: config.s3BucketName,
        region: config.s3Region,
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      }),
    );
  }

  return new FileStorageService(new LocalFileStorageAdapter({ rootPath: config.localStorageRoot }));
}

function computeSha256(body) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

module.exports = {
  LocalFileStorageAdapter,
  S3FileStorageAdapter,
  FileStorageService,
  createFileStorageService,
  computeSha256,
};
