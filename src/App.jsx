import React, { useRef, useState, useEffect } from 'react';

function distance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}
function angle(p1, p2, p3) {
  const a = { x: p1.x - p2.x, y: p1.y - p2.y };
  const b = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = a.x * b.x + a.y * b.y;
  const lenA = Math.sqrt(a.x ** 2 + a.y ** 2);
  const lenB = Math.sqrt(b.x ** 2 + b.y ** 2);
  const rad = Math.acos(dot / (lenA * lenB));
  return (rad * 180 / Math.PI).toFixed(2);
}

export default function App() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const containerRef = useRef();
  const [videoURL, setVideoURL] = useState(null);
  const [points, setPoints] = useState([]);
  const [captured, setCaptured] = useState(false);
  const [videoDims, setVideoDims] = useState({ w: 1920, h: 1080 });
  const [frameTime, setFrameTime] = useState(null);
  const [fps, setFps] = useState(30);
  const [distanceHistory, setDistanceHistory] = useState([]);
  const [angleHistory, setAngleHistory] = useState([]);

  // 実長換算（スケール設定）用
  const [scale, setScale] = useState(null); // {value, unit}
  const [scalePoints, setScalePoints] = useState([]);
  const [scaleInput, setScaleInput] = useState("");
  const [isSettingScale, setIsSettingScale] = useState(false);

  // 表示上の幅を取得（レスポンシブ用）
  const [displayW, setDisplayW] = useState(1920);
  const [displayH, setDisplayH] = useState(1080);

  // 表示サイズをウィンドウ幅に合わせて更新
  const updateDisplaySize = () => {
    if (!containerRef.current) return;
    const w = containerRef.current.offsetWidth;
    const aspect = videoDims.w / videoDims.h;
    setDisplayW(w);
    setDisplayH(Math.round(w / aspect));
  };

  useEffect(() => {
    updateDisplaySize();
    window.addEventListener("resize", updateDisplaySize);
    return () => window.removeEventListener("resize", updateDisplaySize);
  }, [videoDims.w, videoDims.h]);

  const handleUpload = e => {
    setVideoURL(URL.createObjectURL(e.target.files[0]));
    setPoints([]);
    setCaptured(false);
    setFrameTime(null);
    setScale(null);
    setScalePoints([]);
    setIsSettingScale(false);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video?.videoWidth && video?.videoHeight) {
      setVideoDims({ w: video.videoWidth, h: video.videoHeight });
      setTimeout(updateDisplaySize, 200);
    }
  };

  const stepFrame = (direction) => {
    const video = videoRef.current;
    if (!video || isNaN(fps) || fps <= 0) return;
    const dt = 1 / fps;
    let newTime = video.currentTime + (direction === "forward" ? dt : -dt);
    if (newTime < 0) newTime = 0;
    if (newTime > video.duration) newTime = video.duration;
    video.currentTime = newTime;
    setTimeout(() => { video.pause(); }, 50);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = videoDims.w;
    canvas.height = videoDims.h;
    canvas.getContext('2d').drawImage(video, 0, 0, videoDims.w, videoDims.h);
    setPoints([]);
    setCaptured(true);
    setFrameTime(video.currentTime);
    setScalePoints([]);
    setIsSettingScale(false);
  };

  // 距離・角度履歴・スケール設定に対応
  const handleCanvasClick = e => {
    if (!captured) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // 表示上の座標
    const dispX = e.clientX - rect.left;
    const dispY = e.clientY - rect.top;
    // 表示サイズ→実ピクセルに換算
    const scaleX = videoDims.w / displayW;
    const scaleY = videoDims.h / displayH;
    const x = dispX * scaleX;
    const y = dispY * scaleY;

    if (isSettingScale) {
      if (scalePoints.length < 2) {
        setScalePoints(ps => {
          const newPs = [...ps, { x, y }];
          if (newPs.length === 2) setIsSettingScale(false);
          return newPs;
        });
      }
      return;
    }

    const newPoints = [...points, { x, y }];
    setPoints(newPoints);

    if (newPoints.length === 2) {
      const d = distance(newPoints[0], newPoints[1]);
      setDistanceHistory(hist => [...hist, d]);
    }
    if (newPoints.length === 3) {
      const ang = angle(newPoints[0], newPoints[1], newPoints[2]);
      setAngleHistory(hist => [...hist, ang]);
    }
  };

  // 1行だけ削除
  const removeDistanceAt = idx => {
    setDistanceHistory(history => history.filter((_, i) => i !== idx));
  };
  const removeAngleAt = idx => {
    setAngleHistory(history => history.filter((_, i) => i !== idx));
  };

  // 描画（見た目はdisplayW, displayH、実解像度はvideoDims.w, videoDims.h）
  useEffect(() => {
    if (!captured) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, videoDims.w, videoDims.h);
      ctx.drawImage(videoRef.current, 0, 0, videoDims.w, videoDims.h);
      // 通常マーク
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.font = '16px Arial';
        ctx.fillText(i + 1, p.x + 8, p.y - 8);
      });
      // スケール設定用マーク
      scalePoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'blue';
        ctx.fill();
        ctx.font = '14px Arial';
        ctx.fillStyle = 'blue';
        ctx.fillText("S" + (i + 1), p.x + 8, p.y - 8);
      });
    }
  }, [points, captured, videoDims.w, videoDims.h, scalePoints]);

  return (
    <div style={{ padding: 20, background: "#222", minHeight: "100vh", color: "#fff" }}>
      <h2>動画座標計算アプリ（レスポンシブ実長換算・履歴）</h2>
      <input type="file" accept="video/*" onChange={handleUpload} />
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        フレームレート（fps）:
        <input
          type="number"
          min="1"
          max="120"
          step="0.01"
          value={fps}
          onChange={e => setFps(Number(e.target.value))}
          style={{ width: 60, marginLeft: 6 }}
        />（動画のfpsがわかれば入力してください）
      </div>

      {/* --- スケール（実長換算）設定 --- */}
      <div style={{
        marginTop: 20,
        padding: 12,
        border: "1.5px solid #fff",
        background: "rgba(40,40,40,0.97)",
        borderRadius: 10,
        color: "#fff",
        boxShadow: "0 2px 12px #0005"
      }}>
        <div style={{
          background: "rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: 8,
          marginBottom: 8,
          border: "1px solid #fff2"
        }}>
          <strong>スケール設定（実長換算）</strong>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>「スケール設定モード」にして動画上で基準2点をクリック</li>
            <li>その実際の距離を入力し「スケール決定」を押してください</li>
          </ol>
        </div>
        <button
          onClick={() => { setScalePoints([]); setScale(null); setIsSettingScale(true); }}
          style={{ marginTop: 5, marginBottom: 5 }}
        >スケール設定モード</button>
        {scalePoints.length === 2 &&
          <div>
            ピクセル距離: {distance(scalePoints[0], scalePoints[1]).toFixed(2)} px<br />
            実際の距離：
            <input
              type="number"
              value={scaleInput}
              onChange={e => setScaleInput(e.target.value)}
              style={{ width: 80, marginLeft: 8, marginRight: 4 }}
              placeholder="例: 100"
            />
            <select
              value={scale?.unit || "cm"}
              onChange={e => setScale(s => s ? { ...s, unit: e.target.value } : { unit: e.target.value, value: null })}
            >
              <option value="cm">cm</option>
              <option value="m">m</option>
            </select>
            <button
              style={{ marginLeft: 8 }}
              onClick={() => {
                const px = distance(scalePoints[0], scalePoints[1]);
                const real = parseFloat(scaleInput);
                const unit = scale?.unit || "cm";
                if (px > 0 && real > 0) {
                  setScale({ value: real / px, unit });
                  setIsSettingScale(false);
                  alert("スケール設定完了");
                }
              }}
            >スケール決定</button>
          </div>
        }
        {scale && <div style={{ marginTop: 6, color: "#b6e" }}>
          1px = {scale.value.toFixed(4)} {scale.unit}（設定済）
          <button style={{ marginLeft: 8 }} onClick={() => setScale(null)}>解除</button>
        </div>}
        {isSettingScale && <div style={{ color: "skyblue", marginTop: 8 }}>→ 動画上で2点クリックしてください</div>}
      </div>

      {/* --- 動画＆canvas --- */}
      <div
        ref={containerRef}
        style={{
          width: videoDims.w, //等倍優先
          margin: "32px auto 0",
          position: "relative",
          background: "#111",
          borderRadius: "12px"
        }}
      >
        {videoURL && (
          <div style={{ position: "relative", width: "100%", height: displayH, minHeight: 100 }}>
            {/* 動画 */}
            <video
              ref={videoRef}
              src={videoURL}
              controls
              style={{
                display: captured ? "none" : "block",
                width: "100%",
                height: "100%",
                borderRadius: "12px",
                position: "absolute",
                left: 0, top: 0, zIndex: 1
              }}
              onLoadedMetadata={handleLoadedMetadata}
            />
            {/* キャプチャ静止画（Canvas） */}
            <canvas
              ref={canvasRef}
              width={videoDims.w}
              height={videoDims.h}
              style={{
                display: captured ? "block" : "none",
                position: "absolute",
                left: 0, top: 0, zIndex: 2,
                border: "1px solid #fff2",
                width: "100%",
                height: displayH,
                borderRadius: "12px",
                cursor: captured || isSettingScale ? "crosshair" : "not-allowed",
                background: "transparent"
              }}
              onClick={handleCanvasClick}
            />
          </div>
        )}
      </div>
      {videoURL && !captured && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => stepFrame("back")}>◀︎ 1フレーム戻る</button>
          <button onClick={() => stepFrame("forward")} style={{ marginLeft: 12 }}>1フレーム進む ▶︎</button>
        </div>
      )}
      {videoURL && (
        <div style={{ marginTop: 12 }}>
          <button onClick={handleCapture} style={{ marginRight: 10 }} disabled={captured}>
            静止画キャプチャ
          </button>
          <button onClick={() => { setPoints([]); }} style={{ marginRight: 10 }}>
            点リセット
          </button>
          <button onClick={() => {
            setCaptured(false); setPoints([]); setFrameTime(null);
            setScalePoints([]); setIsSettingScale(false);
          }}>
            動画に戻る
          </button>
        </div>
      )}
      {videoURL && (
        <div style={{ marginTop: 20 }}>
          {captured && frameTime !== null &&
            <div style={{ fontWeight: "bold", color: "#06e" }}>
              キャプチャ時刻: {Math.round(frameTime * 1000)} ms（{frameTime.toFixed(3)} 秒）
            </div>
          }
          <strong>取得座標:</strong>
          {points.map((p, i) => (
            <div key={i}>点{i + 1}: ({points[i].x.toFixed(0)}, {points[i].y.toFixed(0)})</div>
          ))}
          {points.length === 2 &&
            <div>
              距離: {distance(points[0], points[1]).toFixed(2)} px
              {scale && (
                <span style={{ marginLeft: 8, color: "#0fa" }}>
                  （{(distance(points[0], points[1]) * scale.value).toFixed(2)} {scale.unit}）
                </span>
              )}
            </div>
          }
          {points.length === 3 &&
            <div>角度(点2を頂点): {angle(points[0], points[1], points[2])}°</div>
          }
        </div>
      )}

      {/* 距離の履歴 */}
      <div style={{ marginTop: 30 }}>
        <strong>距離の履歴：</strong>
        <ul>
          {distanceHistory.map((d, i) => (
            <li key={i}>No.{i + 1}　{d.toFixed(2)} px
              {scale && <span style={{ marginLeft: 8, color: "#0fa" }}>
                （{(d * scale.value).toFixed(2)} {scale.unit}）
              </span>}
              <button style={{ marginLeft: 10 }} onClick={() => removeDistanceAt(i)}>削除</button>
            </li>
          ))}
        </ul>
        <button onClick={() => setDistanceHistory([])}>全てリセット</button>
      </div>

      {/* 角度の履歴 */}
      <div style={{ marginTop: 30 }}>
        <strong>角度の履歴：</strong>
        <ul>
          {angleHistory.map((ang, i) => (
            <li key={i}>
              No.{i + 1}　{ang}°
              <button style={{ marginLeft: 10 }} onClick={() => removeAngleAt(i)}>削除</button>
            </li>
          ))}
        </ul>
        <button onClick={() => setAngleHistory([])}>全てリセット</button>
      </div>

      <div style={{ marginTop: 30, fontSize: 12, color: '#ccc' }}>
        <div>使い方：</div>
        <ol>
          <li>動画ファイル（mp4等）をアップロード</li>
          <li>fps（動画のフレームレート）がわかれば入力</li>
          <li>好きなフレームで一時停止、または「1フレーム戻す／進む」ボタンで細かく調整</li>
          <li>「静止画キャプチャ」ボタンをクリック</li>
          <li>スケール設定したい場合は「スケール設定モード」で2点を選び実長を入力</li>
          <li>通常の2点で距離、3点で角度、どちらも履歴が保存されます</li>
          <li>距離はスケール設定後「実長（cm, m等）」でも表示されます</li>
          <li>「削除」ボタンで1行ずつ履歴削除・「全てリセット」で全消去</li>
          <li>「動画に戻る」ボタンでまた動画再生へ</li>
          <li><b>ウィンドウ幅に応じて動画も自動リサイズ！</b></li>
        </ol>
      </div>
    </div>
  );
}