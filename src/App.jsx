import React, { useRef, useState, useEffect, useCallback } from 'react';

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
  const [videoDims, setVideoDims] = useState({ w: 1920, h: 1080 });
  const [fps, setFps] = useState(30);
  const [distanceHistory, setDistanceHistory] = useState([]);
  const [angleHistory, setAngleHistory] = useState([]);

  // スケール設定用
  const [scale, setScale] = useState(null);
  const [scalePoints, setScalePoints] = useState([]);
  const [scaleInput, setScaleInput] = useState("");
  const [isSettingScale, setIsSettingScale] = useState(false);
  
  // 座標取得モード
  const [isCoordinateMode, setIsCoordinateMode] = useState(false);

  const handleUpload = useCallback(e => {
    setVideoURL(URL.createObjectURL(e.target.files[0]));
    setPoints([]);
    setScale(null);
    setScalePoints([]);
    setIsSettingScale(false);
    setIsCoordinateMode(false);
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video?.videoWidth && video?.videoHeight) {
      setVideoDims({ w: video.videoWidth, h: video.videoHeight });
      
      // まずメタデータからfpsを取得を試行
      tryGetFPSFromMetadata(video);
      
      // メタデータで取得できない場合はフレーム比較で検出
      setTimeout(() => {
        if (fps === 30) { // デフォルト値のままなら検出を実行
          detectVideoFPS(video);
        }
      }, 1000);
    }
  };

  // メタデータからfpsを取得
  const tryGetFPSFromMetadata = useCallback((video) => {
    try {
      if (video.duration && video.duration > 0) {
        const startTime = 0;
        const endTime = Math.min(video.duration, 1);
        
        video.currentTime = startTime;
        video.addEventListener('seeked', async () => {
          const startImage = await captureFrame(video);
          
          video.currentTime = endTime;
          video.addEventListener('seeked', async () => {
            const endImage = await captureFrame(video);
            
            if (startImage && endImage && !imagesEqual(startImage, endImage)) {
              const estimatedFPS = 1 / (endTime - startTime);
              
              const commonFPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 59.97, 60, 120];
              const closestFPS = commonFPS.reduce((prev, curr) => 
                Math.abs(curr - estimatedFPS) < Math.abs(prev - estimatedFPS) ? curr : prev
              );
              
              if (Math.abs(closestFPS - estimatedFPS) < 1) {
                setFps(closestFPS);
              }
            }
          }, { once: true });
        }, { once: true });
      }
    } catch (error) {
      console.error('メタデータからのfps取得に失敗:', error);
    }
  }, []);

  // 動画の実際のフレームレートを検出
  const detectVideoFPS = useCallback(async (video) => {
    try {
      // 複数の時間点でフレームをサンプリング
      const samplePoints = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
      const frameTimes = [];
      const frameImages = [];
      
      // 各サンプルポイントでフレームを取得
      for (let i = 0; i < samplePoints.length; i++) {
        video.currentTime = samplePoints[i];
        await new Promise(resolve => {
          video.addEventListener('seeked', resolve, { once: true });
        });
        
        const actualTime = video.currentTime;
        const image = await captureFrame(video);
        
        frameTimes.push(actualTime);
        frameImages.push(image);
      }
      
      // フレームが変わった時間間隔を計算
      const frameIntervals = [];
      for (let i = 1; i < frameImages.length; i++) {
        if (!imagesEqual(frameImages[i-1], frameImages[i])) {
          const interval = frameTimes[i] - frameTimes[i-1];
          frameIntervals.push(interval);
        }
      }
      
      if (frameIntervals.length === 0) {
        return;
      }
      
      // 平均フレーム間隔を計算
      const avgInterval = frameIntervals.reduce((sum, interval) => sum + interval, 0) / frameIntervals.length;
      const detectedFPS = 1 / avgInterval;
      
      // 一般的なfps値に最も近い値に丸める
      const commonFPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 59.97, 60, 120];
      const closestFPS = commonFPS.reduce((prev, curr) => 
        Math.abs(curr - detectedFPS) < Math.abs(prev - detectedFPS) ? curr : prev
      );
      
      setFps(closestFPS);
      
    } catch (error) {
      console.error('fps検出に失敗:', error);
    }
  }, []);

  // フレームをキャプチャ
  const captureFrame = useCallback((video) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    });
  }, []);

  // 画像データが等しいかチェック
  const imagesEqual = useCallback((img1, img2) => {
    if (!img1 || !img2) return false;
    if (img1.data.length !== img2.data.length) return false;
    
    const sampleSize = Math.min(1000, img1.data.length);
    for (let i = 0; i < sampleSize; i += 4) {
      if (img1.data[i] !== img2.data[i] || 
          img1.data[i+1] !== img2.data[i+1] || 
          img1.data[i+2] !== img2.data[i+2]) {
        return false;
      }
    }
    return true;
  }, []);

  const stepFrame = useCallback((direction) => {
    const video = videoRef.current;
    if (!video || isNaN(fps) || fps <= 0) return;

    const currentTime = video.currentTime;
    const currentFrame = Math.round(currentTime * fps);
    const nextFrame = direction === "forward" ? currentFrame + 1 : currentFrame - 1;
    let newTime = nextFrame / fps;

    // 範囲チェック
    if (newTime < 0) newTime = 0;
    if (newTime > video.duration) newTime = video.duration;

    video.currentTime = newTime;
    
    // 座標取得モード時は点を自動リセット
    if (isCoordinateMode) {
      setPoints([]);
    }
    
    setTimeout(() => { video.pause(); }, 100);
  }, [fps, isCoordinateMode]);


  // 動画上でのクリックハンドラー
  const handleVideoClick = useCallback(e => {
    if (!isCoordinateMode) return;
    
    // 座標取得モード時は動画の再生/停止を防ぐ
    e.preventDefault();
    e.stopPropagation();
    
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 動画の実際のサイズに合わせて座標を調整
    const scaleX = videoDims.w / rect.width;
    const scaleY = videoDims.h / rect.height;
    const adjustedX = x * scaleX;
    const adjustedY = y * scaleY;
    
    // スケール設定モード時の処理
    if (isSettingScale) {
      if (scalePoints.length < 2) {
        setScalePoints(ps => {
          const newPs = [...ps, { x: adjustedX, y: adjustedY }];
          if (newPs.length === 2) setIsSettingScale(false);
          return newPs;
        });
      }
      return;
    }
    
    // 通常の座標取得モード時の処理
    const newPoints = [...points, { x: adjustedX, y: adjustedY }];
    setPoints(newPoints);

    if (newPoints.length === 2) {
      const d = distance(newPoints[0], newPoints[1]);
      setDistanceHistory(hist => [...hist, d]);
    }
    if (newPoints.length === 3) {
      const ang = angle(newPoints[0], newPoints[1], newPoints[2]);
      setAngleHistory(hist => [...hist, ang]);
    }
  }, [isCoordinateMode, isSettingScale, scalePoints.length, points, videoDims.w, videoDims.h]);


  const removeDistanceAt = useCallback(idx => {
    setDistanceHistory(history => history.filter((_, i) => i !== idx));
  }, []);
  
  const removeAngleAt = useCallback(idx => {
    setAngleHistory(history => history.filter((_, i) => i !== idx));
  }, []);

  // エクスポート機能
  const exportToCSV = useCallback(() => {
    const csvData = [];
    csvData.push(['測定タイプ', '値', '単位', '実長換算値', '実長単位', '測定時刻']);
    
    distanceHistory.forEach((distance, i) => {
      const realValue = scale ? (distance * scale.value).toFixed(2) : '';
      const realUnit = scale ? scale.unit : '';
      csvData.push([
        '距離',
        distance.toFixed(2),
        'px',
        realValue,
        realUnit,
        videoRef.current?.currentTime ? `${videoRef.current.currentTime.toFixed(3)}秒` : '不明'
      ]);
    });
    
    angleHistory.forEach((angle, i) => {
      csvData.push([
        '角度',
        angle,
        '度',
        '',
        '',
        videoRef.current?.currentTime ? `${videoRef.current.currentTime.toFixed(3)}秒` : '不明'
      ]);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    downloadFile(csvContent, 'measurements.csv', 'text/csv');
  }, [distanceHistory, angleHistory, scale]);

  const exportToJSON = useCallback(() => {
    const jsonData = {
      metadata: {
        videoDimensions: videoDims,
        currentTime: videoRef.current?.currentTime || 0,
        fps: fps,
        scale: scale,
        zoomLevel: zoomLevel,
        zoomCenter: zoomCenter,
        exportDate: new Date().toISOString()
      },
      measurements: {
        distances: distanceHistory.map((distance, i) => ({
          id: i + 1,
          value: distance,
          unit: 'px',
          realValue: scale ? distance * scale.value : null,
          realUnit: scale ? scale.unit : null
        })),
        angles: angleHistory.map((angle, i) => ({
          id: i + 1,
          value: parseFloat(angle),
          unit: '度'
        }))
      }
    };
    
    downloadFile(JSON.stringify(jsonData, null, 2), 'measurements.json', 'application/json');
  }, [videoDims, fps, scale, distanceHistory, angleHistory]);

  const exportAllData = useCallback(() => {
    const allData = {
      metadata: {
        videoDimensions: videoDims,
        currentTime: videoRef.current?.currentTime || 0,
        fps: fps,
        scale: scale,
        zoomLevel: zoomLevel,
        zoomCenter: zoomCenter,
        exportDate: new Date().toISOString()
      },
      currentPoints: points,
      measurements: {
        distances: distanceHistory.map((distance, i) => ({
          id: i + 1,
          value: distance,
          unit: 'px',
          realValue: scale ? distance * scale.value : null,
          realUnit: scale ? scale.unit : null
        })),
        angles: angleHistory.map((angle, i) => ({
          id: i + 1,
          value: parseFloat(angle),
          unit: '度'
        }))
      }
    };
    
    downloadFile(JSON.stringify(allData, null, 2), 'all_data.json', 'application/json');
  }, [videoDims, fps, scale, distanceHistory, angleHistory, points, scalePoints]);

  const downloadFile = useCallback((content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // 描画（座標取得モード時のみ）
  useEffect(() => {
    if (!isCoordinateMode) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, videoDims.w, videoDims.h);
      // 通常マーク
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
        // 白い縁を追加
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '18px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(i + 1, p.x + 12, p.y - 12);
      });
      // スケール設定用マーク
      scalePoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'blue';
        ctx.fill();
        // 白い縁を追加
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText("S" + (i + 1), p.x + 12, p.y - 12);
      });
    }
  }, [points, isCoordinateMode, videoDims.w, videoDims.h, scalePoints]);

  return (
    <div style={{ 
      padding: "20px", 
      background: "#222", 
      minHeight: "100vh", 
      color: "#fff",
      maxWidth: "1400px",
      margin: "0 auto",
      boxSizing: "border-box"
    }}>
      <h2>動画座標計算アプリ（レスポンシブ実長換算・履歴）</h2>
      <input type="file" accept="video/*" onChange={handleUpload} />
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        フレームレート（fps）:
        <input
          type="number"
          min="1"
          max="120"
          step="0.001"
          value={fps}
          onChange={e => setFps(Number(e.target.value))}
          style={{ width: 80, marginLeft: 6 }}
        />
        <button
          onClick={() => {
            if (videoRef.current) {
              detectVideoFPS(videoRef.current);
            }
          }}
          style={{ 
            marginLeft: 8, 
            padding: "4px 8px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          自動検出
        </button>
        <button
          onClick={() => setFps(59.97)}
          style={{ 
            marginLeft: 4, 
            padding: "4px 8px",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          59.97
        </button>
        <button
          onClick={() => setFps(29.97)}
          style={{ 
            marginLeft: 4, 
            padding: "4px 8px",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          29.97
        </button>
        <div style={{ marginTop: 4, fontSize: "12px", color: "#666" }}>
          現在のfps: {fps} | 動画のfpsがわかれば入力してください（例：59.97）
        </div>
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
            <li>「スケール設定モード」をクリック（自動的に座標取得モードに切り替わります）</li>
            <li>動画上で基準2点をクリック</li>
            <li>その実際の距離を入力し「スケール決定」を押してください</li>
          </ol>
        </div>
        <button
          onClick={() => { 
            setScalePoints([]); 
            setScale(null); 
            setIsSettingScale(true);
            setIsCoordinateMode(true);
          }}
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
          width: "100%",
          maxWidth: "1200px", // 最大幅を設定
          margin: "32px auto 0",
          position: "relative",
          background: "#111",
          borderRadius: "12px"
        }}
      >
        {videoURL && (
          <div style={{ 
            position: "relative", 
            width: videoDims.w, // オリジナルサイズで表示
            height: videoDims.h, // オリジナルサイズで表示
            margin: "0 auto", // 中央揃え
            background: "#000"
          }}>
            {/* 動画 */}
            <video
              ref={videoRef}
              src={videoURL}
              controls={!isCoordinateMode}
              preload="metadata"
              style={{
                display: "block",
                width: videoDims.w,
                height: videoDims.h,
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 1,
                pointerEvents: isCoordinateMode ? "none" : "auto",
                cursor: isCoordinateMode ? "crosshair" : "default"
              }}
              onLoadedMetadata={handleLoadedMetadata}
            />
            {/* 座標表示用Canvas（座標取得モード時のみ） */}
            {isCoordinateMode && (
              <canvas
                ref={canvasRef}
                width={videoDims.w}
                height={videoDims.h}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: videoDims.w,
                  height: videoDims.h,
                  background: "transparent",
                  zIndex: 2,
                  pointerEvents: "none"
                }}
              />
            )}
            {/* 座標取得モード時のオーバーレイ */}
            {isCoordinateMode && (
              <div
                onClick={handleVideoClick}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: videoDims.w,
                  height: videoDims.h,
                  background: "transparent",
                  zIndex: 3,
                  pointerEvents: "auto",
                  cursor: "crosshair"
                }}
              />
            )}
          </div>
        )}
      </div>
      {videoURL && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => stepFrame("back")}>◀︎ 1フレーム戻る</button>
          <button onClick={() => stepFrame("forward")} style={{ marginLeft: 12 }}>1フレーム進む ▶︎</button>
          <button 
            onClick={() => setIsCoordinateMode(!isCoordinateMode)}
            style={{ 
              marginLeft: 12,
              background: isCoordinateMode ? "#4CAF50" : "#666",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            {isCoordinateMode ? "座標取得モード ON" : "座標取得モード OFF"}
          </button>
          {isCoordinateMode && (
            <div style={{ marginTop: 8, fontSize: "12px", color: "#4CAF50" }}>
              {isSettingScale ? (
                <>
                  → スケール設定モード：動画上で基準2点をクリックしてください<br />
                  → 2点目をクリックすると自動的にスケール設定完了
                </>
              ) : (
                <>
                  → 動画上でクリックして座標を取得できます（動画は停止状態）<br />
                  → 1フレーム進むと点は自動でリセットされます
                </>
              )}
            </div>
          )}
        </div>
      )}
      {videoURL && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => { setPoints([]); }} style={{ marginRight: 10 }}>
            点リセット
          </button>
          <button onClick={() => {
            setPoints([]);
            setScalePoints([]); 
            setIsSettingScale(false);
            setIsCoordinateMode(false);
          }}>
            リセット
          </button>
        </div>
      )}
      {videoURL && (
        <div style={{ marginTop: 20 }}>
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

      {/* --- エクスポート機能 --- */}
      <div style={{ marginTop: 30 }}>
        <strong>データエクスポート：</strong>
        <div style={{ marginTop: 10, display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => exportToCSV()}
            style={{
              padding: "8px 16px",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            CSVでエクスポート
          </button>
          <button
            onClick={() => exportToJSON()}
            style={{
              padding: "8px 16px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            JSONでエクスポート
          </button>
          <button
            onClick={() => exportAllData()}
            style={{
              padding: "8px 16px",
              background: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            全データエクスポート
          </button>
        </div>
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