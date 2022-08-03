import "./style.less";
import React from "react";
import { useSelector } from "react-redux";
import { selectSeek, selectCurrent } from "@store/slices/player-status.slice";
import lyricParse, { LyricScript } from "@plugins/lyric-parser";
import { useTranslation } from "react-i18next";

export default function PageLyric() {
  const { t } = useTranslation();
  const current = useSelector(selectCurrent);
  const seek = useSelector(selectSeek);

  const [lyrics, setLyrics] = React.useState<LyricScript[]>();
  const [isScrolling, setIsScrolling] = React.useState(false);

  const ref = React.useRef<any>();

  const isHit = (sk: number, st: number, en: number) => {
    return sk > st && sk < en;
  };

  const handleScroll = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsScrolling(true);
    },
    [isScrolling]
  );

  React.useEffect(() => {
    const lyric = current?.lyric;
    if (lyric) {
      const lyricScripts = lyricParse(lyric).scripts;
      setLyrics(lyricScripts);
    }
  }, [current?.src]);

  React.useEffect(() => {
    setIsScrolling(false);
  }, [seek]);
  
  const renderLyricItem = React.useCallback((lyric, idx: number) => {
    const hit = isHit(seek, lyric.start, lyric.end);
    const cls = hit ? "lyric-item hit" : "lyric-item";
    const toTop = idx * 28;

    // when hit, scroll the element
    if (hit && !isScrolling) {
      setTimeout(() => {
        ref?.current?.scrollTo({top: toTop, behavior: "smooth"});
      }, 250);
    }

    return (
      <div className={cls} key={lyric.start + idx}>
        <span>{lyric.text}</span>
      </div>
    );
  }, [seek]);

  return (
    <div
      className={"page page-lyric electron-no-drag perfect-scrollbar"}
      ref={ref}
      onScroll={handleScroll}
    >
      <div className={"lyric-panel"}>
        <div className={"spacer"}></div>
        {lyrics
          ? lyrics.map(renderLyricItem)
          : <div className={"no-lyric"}>{t("No" + " Lyric")}</div>
        }
      </div>
    </div>
  );
}
