// src/storage/jsonStorage.ts

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readJson<T>(filename: string): Promise<T> {
  try {
    const data = await readFile(join(DATA_DIR, filename), "utf8");
    return JSON.parse(data) as T;
  } catch {
    return {} as T;
  }
}

export async function writeJson(filename: string, data: unknown): Promise<void> {
  await ensureDataDir();
  await writeFile(join(DATA_DIR, filename), JSON.stringify(data, null, 2), "utf8");
}