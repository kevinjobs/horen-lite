import path from "path";
import fs from "fs";
import { AUDIO_EXTS } from "@constant/index";
import crypto from "crypto";
import pack from "../../../package.json";
import * as mm from "music-metadata";
import { Netease } from "../apis";
import axios from "axios";
import { HandlerResponse } from "./index";
import {walksAsync, readFileAsync, writeFileAsync} from "../utils/fs-promises";
import {arrayBufferToBase64} from "../utils";

type AudioMeta = Partial<{
  src: string;
  title: string;
  artist: string;
  artists: string | string[];
  album: string;
  genre: string | string[];
  date: string;
  duration: number;
  picture: string;
  lyric: string;
}>;

async function handleGetAudioFileMeta(
  evt,
  p: string,
  items?: string[]
): Promise<HandlerResponse<AudioMeta>> {
  let meta: AudioMeta;
  if (items) {
    meta = await readMusicFileMeta(p, items);
  } else {
    meta = await readMusicFileMeta(p);
  }
  return { code: 1, msg: "success", data: meta };
}

async function handleGetAudioFileList(evt, p: string) {
  const audioFileListFull = await getAudioFileListFromLibraryFile(p, "full");

  if (audioFileListFull.length > 0) {
    return {
      code: 1,
      msg: "success",
      data: { lists: audioFileListFull },
    };
  } else {
    const audioFileListShort = await getAudioFileListFromLibraryFile(
      p,
      "short"
    );
    if (audioFileListShort.length > 0) {
      return {
        code: 1,
        msg: "success",
        data: { lists: audioFileListShort },
      };
    }
  }
  // if library file doesn't exist, rebuild it.
  const originFileList = await getOriginFileList(p);

  if (originFileList.length === 0) {
    return {
      code: 0,
      msg: "failed",
      err: "target path is empty: " + p,
    };
  }

  const lists = filterAudioFile(originFileList);
  // save to the library file.
  try {
    await writeFileAsync(p, JSON.stringify(lists, null, 2));
  } catch (err) {
    console.error("save the library file failed.");
  }

  return {
    code: 1,
    msg: "success",
    data: { lists },
  };
}

function filterAudioFile(originFileList: string[]) {
  const tmp = [];
  for (const m of originFileList) {
    const extname = path.extname(m).replace(".", "");
    if (AUDIO_EXTS.includes(extname)) tmp.push({ src: m });
  }
  return tmp;
}

async function getAudioFileListFromLibraryFile(
  p: string,
  flag: "short" | "full"
) {
  let libraryFilePath: string;
  switch (flag) {
  case "short":
    libraryFilePath = generateLibraryFilePath(p);
    break;
  case "full":
    libraryFilePath = generateLibraryFilePath(p, "-full");
    break;
  }
  try {
    const jsonStr = await readFileAsync(libraryFilePath);
    return JSON.parse(jsonStr);
  } catch (err) {
    return [];
  }
}

async function getOriginFileList(p: string) {
  const tmp = [];
  try {
    return await walksAsync(path.resolve(p), tmp);
  } catch (err) {
    console.error(err);
    return [];
  }
}

function generateLibraryFilePath(p: string, flag = "") {
  const hash = crypto.createHash("md5");
  hash.update(p);

  const appPath = path.join(process.env.APPDATA, pack.name);
  const musicLibraryPath = path.join(appPath, "MusicLibrary");

  if (!fs.existsSync(musicLibraryPath)) {
    fs.mkdirSync(musicLibraryPath);
  }

  return path.join(musicLibraryPath, `${hash.digest("hex")}${flag}.json`);
}

async function readMusicFileMeta(
  filepath: string,
  items = [
    "title",
    "artist",
    "artists",
    "album",
    "genre",
    "date",
    "duration",
    "picture",
    "lyric",
  ]
): Promise<AudioMeta> {
  let meta;

  try {
    meta = await mm.parseFile(filepath);
  } catch (err) {
    meta = null;
  }

  const { title, artist, artists, album, genre, date, picture } =
    meta?.common || {};

  const extname = path.extname(filepath);
  const finalTitle = title || path.basename(filepath, extname);

  const { duration } = meta?.format || {};

  let lyric: string;
  if (items.includes("lyric")) {
    const lrcPath = filepath.replace(extname, ".lrc");
    try {
      lyric = await readFileAsync(lrcPath);
    } catch (err) {
      console.log("there is no local lrc file.");

      const neteaseApi = new Netease(title, artist, album);
      try {
        lyric = await neteaseApi.getLyric();
        if (lyric) await writeFileAsync(lrcPath, lyric);
      } catch (err) {
        lyric = String(err);
      }
    }
  }

  let finalPic: string;
  if (items.includes("picture")) {
    if (picture) {
      const data = picture[0]?.data;
      finalPic = arrayBufferToBase64(data);
    } else {
      const hash = crypto.createHash("md5");
      hash.update(artist + album);
      const picDir = path.join(process.env.APPDATA, pack.name, "AlbumCover");
      const picPath = path.join(picDir, `${hash.digest("hex")}.png`);

      if (!fs.existsSync(picDir)) {
        fs.mkdirSync(picDir);
      }

      if (fs.existsSync(picPath)) {
        finalPic = "file:///" + picPath;
      } else {
        const neteaseApi = new Netease(title, artist, album);
        const picUrl = await neteaseApi.getAlbumPic();
        finalPic = picUrl;

        if (picUrl) {
          const resp = await axios.get(picUrl, { responseType: "arraybuffer" });
          if (resp.data) {
            await writeFileAsync(picPath, resp.data);
          }
        }
      }
    }
  }

  return {
    src: filepath,
    title: items.includes("title") ? finalTitle : null,
    artist: items.includes("artist") ? artist : null,
    artists: items.includes("artists") ? artists : null,
    album: items.includes("album") ? album : null,
    genre: items.includes("genre") ? genre : null,
    date: items.includes("date") ? date : null,
    duration: items.includes("duration") ? duration : null,
    picture: items.includes("lyric") ? finalPic : null,
    lyric: items.includes("lyric") ? lyric : null,
  };
}

export type { AudioMeta };

export {
  handleGetAudioFileList,
  handleGetAudioFileMeta,
  readMusicFileMeta,
  generateLibraryFilePath,
};