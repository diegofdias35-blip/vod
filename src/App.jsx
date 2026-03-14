import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState('')
  const [showLeftAnim, setShowLeftAnim] = useState(false)
  const [showRightAnim, setShowRightAnim] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const playerRef = useRef(null)
  const wrapperRef = useRef(null)
  
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
                title="Duplo clique: Voltar 10s"
              />
              <div 
                className="overlay-right" 
                onDoubleClick={() => handleSeek(10)}
                title="Duplo clique: Avançar 10s"
              />

              {/* Animações de Feedback */}
              {showLeftAnim && <div className="seek-anim left">-10s</div>}
              {showRightAnim && <div className="seek-anim right">+10s</div>}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
