import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState('')
  const [showLeftAnim, setShowLeftAnim] = useState(false)
  const [showRightAnim, setShowRightAnim] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Estados para exibição do acúmulo de tempo
  const [accumulatedLeft, setAccumulatedLeft] = useState(0)
  const [accumulatedRight, setAccumulatedRight] = useState(0)
  
  const playerRef = useRef(null)
  const wrapperRef = useRef(null)
  const lastTapRef = useRef({ left: 0, right: 0 })
  const tapTimeoutRef = useRef({ left: null, right: null })
  
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
      autoplay: false,
      muted: false, // Forçar falso para o navegador não tentar bypass de políticas
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

    let saveProgressInterval;

    playerRef.current.addEventListener(window.Twitch.Player.PLAY, () => {
      // Inicia o salvamento apenas quando o vídeo realmente começa a tocar
      if (!saveProgressInterval) {
        saveProgressInterval = setInterval(() => {
          if (playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime();
            if (currentTime > 0) {
              localStorage.setItem(`twitch_vod_${videoId}`, currentTime);
            }
          }
        }, 5000);
      }
    });

    playerRef.current.addEventListener(window.Twitch.Player.PAUSE, () => {
      // Opcional: Pausar o salvamento quando o vídeo pausar para poupar a CPU do mobile
      if (saveProgressInterval) {
        clearInterval(saveProgressInterval);
        saveProgressInterval = null;
      }
    });

    return () => {
      if (saveProgressInterval) clearInterval(saveProgressInterval);
    };
  }, [videoId])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const commitSeekAndAnimate = (side, totalSeconds) => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      playerRef.current.seek(currentTime + totalSeconds);
      
      if (side === 'right') {
        setShowRightAnim(true)
        setTimeout(() => setShowRightAnim(false), 500)
      } else {
        setShowLeftAnim(true)
        setTimeout(() => setShowLeftAnim(false), 500)
      }
    }
    // Zera os acumuladores visuais depois da animação
    setTimeout(() => {
      if (side === 'right') setAccumulatedRight(0);
      else setAccumulatedLeft(0);
    }, 500);
  }

  const handleTap = (side) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 400; // Tempo máximo entre toques em milissegundos
    
    // Anula o timer anterior se a pessoa continuar clicando freneticamente
    if (tapTimeoutRef.current[side]) {
      clearTimeout(tapTimeoutRef.current[side]);
    }

    if (now - lastTapRef.current[side] < DOUBLE_TAP_DELAY) {
      // É um duplo clique ou cliques subsequentes!
      if (side === 'left') {
        // Se já tinha começado, soma +10. Se não, é o 2º clique, começa com 10.
        setAccumulatedLeft(prev => prev === 0 ? 10 : prev + 10);
      } else {
        setAccumulatedRight(prev => prev === 0 ? 10 : prev + 10);
      }

      // Agenda o seek real (executar a ação de pular o tempo) para 400ms depois do ÚLTIMO clique
      tapTimeoutRef.current[side] = setTimeout(() => {
        // Pega o valor acumulado atual através do valor da closure ou ref e commita
        if (side === 'left') {
          setAccumulatedLeft(currentVal => {
            commitSeekAndAnimate('left', -currentVal);
            return currentVal;
          });
        } else {
          setAccumulatedRight(currentVal => {
            commitSeekAndAnimate('right', currentVal);
            return currentVal;
          });
        }
      }, 400);

      lastTapRef.current[side] = now; // Atualiza o último toque
    } else {
      // É apenas o primeiro clique (ou clique após muito tempo)
      lastTapRef.current[side] = now;
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
                onClick={() => handleTap('left')}
                title="Duplo clique: Voltar 10s"
              />
              <div 
                className="overlay-right" 
                onClick={() => handleTap('right')}
                title="Duplo clique: Avançar 10s"
              />

              {/* Animações de Feedback com acúmulo */}
              {(showLeftAnim || accumulatedLeft > 0) && (
                <div className="seek-anim left">-{accumulatedLeft}s</div>
              )}
              {(showRightAnim || accumulatedRight > 0) && (
                <div className="seek-anim right">+{accumulatedRight}s</div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
