import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState('')
  const [showLeftAnim, setShowLeftAnim] = useState(false)
  const [showRightAnim, setShowRightAnim] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSpeedingUp, setIsSpeedingUp] = useState(false)
  
  const playerRef = useRef(null)
  const wrapperRef = useRef(null)
  const holdTimerRef = useRef(null)
  
  const extractVideoId = (inputUrl) => {
    const regex = /(?:twitch\.tv\/videos\/|^\d+$)(\d+)/;
    const match = inputUrl.match(regex);
    if (match) {
      return match[1];
    }
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const id = extractVideoId(url)
    if (id) {
      setVideoId(id)
    } else {
      alert("URL ou ID inválido. Tente algo como https://www.twitch.tv/videos/123456789")
    }
  }

  useEffect(() => {
    if (!videoId) return;

    const embedContainer = document.getElementById('twitch-embed');
    embedContainer.innerHTML = '';

    const options = {
      width: '100%',
      height: '100%',
      video: videoId,
      autoplay: true,
      controls: true,
      parent: ["vod-gamma.vercel.app", "localhost"] 
    };

    playerRef.current = new window.Twitch.Player("twitch-embed", options);

    playerRef.current.addEventListener(window.Twitch.Player.READY, () => {
      console.log("Player is Ready!");
      const savedTime = localStorage.getItem(`twitch_vod_${videoId}`);
      if (savedTime && playerRef.current) {
        playerRef.current.seek(parseFloat(savedTime));
      }
    });

    const saveProgressInterval = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentTime > 0) {
          localStorage.setItem(`twitch_vod_${videoId}`, currentTime);
        }
      }
    }, 5000);

    return () => clearInterval(saveProgressInterval);
  }, [videoId])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSeek = (seconds) => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      playerRef.current.seek(currentTime + seconds);
      
      if (seconds > 0) {
        setShowRightAnim(true)
        setTimeout(() => setShowRightAnim(false), 500)
      } else {
        setShowLeftAnim(true)
        setTimeout(() => setShowLeftAnim(false), 500)
      }
    }
  }

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      // Entrar em tela cheia
      if (wrapperRef.current.requestFullscreen) {
        await wrapperRef.current.requestFullscreen();
      } else if (wrapperRef.current.webkitRequestFullscreen) { /* Safari */
        await wrapperRef.current.webkitRequestFullscreen();
      } else if (wrapperRef.current.msRequestFullscreen) { /* IE11 */
        await wrapperRef.current.msRequestFullscreen();
      }
      
      // Tentar forçar orientação paisagem (Landscape) no Mobile
      if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
        try {
          await window.screen.orientation.lock("landscape");
        } catch (error) {
          console.log("Orientation lock failed/not supported:", error);
        }
      }
      
    } else {
      // Sair de tela cheia
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { /* Safari */
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE11 */
        await document.msExitFullscreen();
      }
      
      // Destrancar orientação
      if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
        try {
          window.screen.orientation.unlock();
        } catch (error) {
          console.log("Orientation unlock failed:", error);
        }
      }
    }
  }

  // --- Handlers para "Segurar para 2x" ---
  const handlePointerDown = () => {
    if (!playerRef.current) return;
    
    // Inicia o timer: se o dedo ficar na tela por mais de 500ms, ativa pseudo-2x
    holdTimerRef.current = setTimeout(() => {
      setIsSpeedingUp(true);
      
      // Como a Twitch API não expõe setPlaybackRate, fazemos um "fast-forward" manual
      // Reduzindo a frequência (de 250ms para 500ms) e aumentando o pulo (para 1s)
      // para evitar bloqueios Rate Limit (Erro 429) do firewall Kasada da Twitch
      const speedInterval = setInterval(() => {
        if (playerRef.current) {
          const currentTime = playerRef.current.getCurrentTime();
          playerRef.current.seek(currentTime + 1);
        }
      }, 500);

      // Guardamos o ID do intervalo no dataset do wrapper para limpar depois
      if (wrapperRef.current) {
        wrapperRef.current.dataset.speedInterval = speedInterval.toString();
      }
    }, 500); 
  }

  const handlePointerUp = () => {
    // Se soltar antes dos 500ms, cancela o timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Se estava em pseudo-2x, volta ao normal limpando o intervalo
    if (isSpeedingUp) {
      setIsSpeedingUp(false);
      
      if (wrapperRef.current && wrapperRef.current.dataset.speedInterval) {
        clearInterval(parseInt(wrapperRef.current.dataset.speedInterval));
        wrapperRef.current.dataset.speedInterval = "";
      }
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>VOD Player</h1>
      </header>
      
      <main className="main-content">
        <form onSubmit={handleSubmit} className="url-form">
          <input 
            type="text" 
            placeholder="Cole o link ou ID do VOD da Twitch..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="url-input"
          />
          <button type="submit" className="submit-btn">Assistir</button>
        </form>

        <div className="player-wrapper" ref={wrapperRef}>
          <div id="twitch-embed">
            {!videoId && (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '1.2rem' }}>
                Aguardando VOD...
              </div>
            )}
          </div>
          
          {/* Overlays de Controle */}
          {videoId && (
            <>
              {/* Botão de Fullscreen Customizado */}
              <button 
                className="custom-fs-btn" 
                onClick={toggleFullscreen}
                title="Tela Cheia"
              >
                {isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
              </button>

              <div 
                className="overlay-left" 
                onDoubleClick={() => handleSeek(-10)}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                title="Duplo clique: Voltar 10s | Segurar: 2x Speed"
              />
              <div 
                className="overlay-right" 
                onDoubleClick={() => handleSeek(10)}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                title="Duplo clique: Avançar 10s | Segurar: 2x Speed"
              />

              {/* Animações de Feedback */}
              {showLeftAnim && <div className="seek-anim left">-10s</div>}
              {showRightAnim && <div className="seek-anim right">+10s</div>}
              
              {/* Feedback de Velocidade 2x */}
              {isSpeedingUp && (
                <div className="speed-anim">
                  Velocidade 2x ⏩
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
