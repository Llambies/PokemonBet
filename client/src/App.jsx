import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
const socket = io(URL);

function App() {
  const [room, setRoom] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [message, setMessage] = useState('');
  const [gameState, setGameState] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pokemonOptions, setPokemonOptions] = useState([]);
  const [auctionPokemon, setAuctionPokemon] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [inAuction, setInAuction] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auctionTimer, setAuctionTimer] = useState(null);
  const [showBidResults, setShowBidResults] = useState(false);
  const [bidResults, setBidResults] = useState(null);
  const [revealWinner, setRevealWinner] = useState(false);

  useEffect(() => {
    socket.on('connect', () => console.log('Connected to server'));
    socket.on('roomCreated', (roomID) => {
      setRoom(roomID);
      setMessage(`Has creado la sala: ${roomID}`);
    });
    socket.on('roomJoined', (roomID) => {
      setRoom(roomID);
      setMessage(`Te has unido a la sala: ${roomID}`);
    });
    socket.on('playerJoined', () => setMessage('Otro jugador se ha unido.'));
    socket.on('roomFull', () => setMessage('La sala está llena.'));

    socket.on('gameStart', (initialGameState) => {
      setGameState(initialGameState);
      setMessage('¡El juego ha comenzado!');
    });

    socket.on('yourTurn', (options) => {
      setLoading(false);
      setIsMyTurn(true);
      setPokemonOptions(options);
      setInAuction(false);
      setMessage('¡Es tu turno! Elige un Pokémon para subastar.');
    });

    socket.on('waitingForOpponent', () => {
        setIsMyTurn(false);
        setLoading(true);
        setMessage('Esperando a que el oponente elija un Pokémon...');
    });

    socket.on('auctionStart', (pokemon) => {
        setLoading(false);
        setAuctionPokemon(pokemon);
        setPokemonOptions([]);
        setIsMyTurn(false);
        setInAuction(true);
        setAuctionTimer(30); // 30 second timer for auction
        setMessage(`¡Subasta iniciada! Puja por ${pokemon.name}`);
    });

    socket.on('auctionReveal', ({ winner, winningBid, pokemon, bids }) => {
        // Show bid results first
        setBidResults({
            winner,
            winningBid,
            pokemon,
            playerBids: bids
        });
        setShowBidResults(true);
        setInAuction(false);
        setAuctionTimer(null);
        
        // Reveal winner after 2 seconds
        setTimeout(() => {
            setRevealWinner(true);
            const winnerMsg = winner === socket.id ? '¡Ganaste la subasta!' : 'El oponente ganó la subasta';
            setMessage(`${winnerMsg} - Se llevó a ${pokemon.name} por ${winningBid} ₽`);
        }, 2000);
    });

    socket.on('auctionResult', ({ gameState: newGameState, message: resultMessage }) => {
        // Update game state after animation
        setGameState(newGameState);
        setMessage(resultMessage);
        
        // Hide animation
        setShowBidResults(false);
        setBidResults(null);
        setRevealWinner(false);
        setAuctionPokemon(null);
    });

    socket.on('gameOver', (finalGameState) => {
        setGameState(finalGameState);
        const endMessage = "¡El draft ha terminado! Este es tu equipo final.";
        setGameOver(endMessage);
        setMessage('¡Juego terminado!');
    });

    socket.on('playerLeft', () => setMessage('El otro jugador ha abandonado la sala.'));

    return () => {
      socket.off('connect');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('playerJoined');
      socket.off('roomFull');
      socket.off('gameStart');
      socket.off('yourTurn');
      socket.off('waitingForOpponent');
      socket.off('auctionStart');
      socket.off('auctionReveal');
      socket.off('auctionResult');
      socket.off('gameOver');
      socket.off('playerLeft');
    };
  }, [room]);

  // Auction timer effect
  useEffect(() => {
    let interval = null;
    if (auctionTimer > 0 && inAuction) {
      interval = setInterval(() => {
        setAuctionTimer(timer => timer - 1);
      }, 1000);
    } else if (auctionTimer === 0) {
      setAuctionTimer(null);
    }
    return () => clearInterval(interval);
  }, [auctionTimer, inAuction]);

  const handleJoinRoom = () => {
    if (roomInput.trim() !== '') socket.emit('joinRoom', roomInput);
  };

  const handleSelectPokemon = (pokemon) => {
    setLoading(true);
    setMessage(`Has elegido a ${pokemon.name} para subastar. Iniciando subasta...`);
    socket.emit('pokemonSelected', { roomID: room, pokemon });
    setPokemonOptions([]);
    setIsMyTurn(false);
  };

  const handlePlaceBid = () => {
    const bid = parseInt(bidAmount, 10);
    if (!isNaN(bid) && bid > 0) {
      socket.emit('placeBid', { roomID: room, bid });
      setBidAmount('');
      setInAuction(false); // Disable bidding after placing one
      setMessage('Puja realizada. Esperando al oponente...');
    }
  };

  const LoadingSpinner = () => (
    <div className="loading-container">
      <div className="pokemon-spinner">
        <div className="pokeball">
          <div className="pokeball-button"></div>
        </div>
      </div>
      <p>Cargando...</p>
    </div>
  );

  const renderLobby = () => (
    <div className="lobby-container">
      <h2>🎮 Únete a una partida</h2>
      <p style={{marginBottom: '20px', color: '#718096'}}>
        Introduce un ID de sala para unirte a una partida existente o crear una nueva
      </p>
      <input
        className="lobby-input"
        type="text"
        placeholder="Ej: sala123"
        value={roomInput}
        onChange={(e) => setRoomInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
      />
      <button 
        className="btn-primary" 
        onClick={handleJoinRoom}
        disabled={!roomInput.trim()}
      >
        {roomInput.trim() ? '🚀 Unirse/Crear Sala' : '🎯 Introduce un ID'}
      </button>
    </div>
  );

  const renderGame = () => (
    <div className="game-container">
        {/* Room Info Header */}
        <div className="room-info">
            <h2>🏟️ Sala: {room}</h2>
            <p>Draft Pokémon - ¡Construye el mejor equipo!</p>
        </div>

        {/* Message Display */}
        {message && (
            <div className="message-display">
                {message}
            </div>
        )}

        {/* Loading State */}
        {loading && <LoadingSpinner />}
        
        {/* Turn Section - Pokemon Selection */}
        {isMyTurn && (
            <div className="turn-section">
                <h3>⚡ ¡Es tu turno! ⚡</h3>
                <p>Elige un Pokémon para subastar</p>
                <div className="pokemon-options">
                    {pokemonOptions.map((p, index) => (
                        <div 
                            key={p.id} 
                            className="pokemon-card" 
                            onClick={() => handleSelectPokemon(p)}
                            style={{animationDelay: `${index * 0.1}s`}}
                        >
                            <img src={p.sprite} alt={p.name} />
                            <p>{p.name}</p>
                            <div className="pokemon-id">#{String(p.id).padStart(3, '0')}</div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Auction Section */}
        {inAuction && (
             <div className="auction-section">
                <div className="auction-header">
                    <h3>🔥 ¡SUBASTA EN VIVO! 🔥</h3>
                    {auctionTimer && (
                        <div className="auction-timer">
                            <div className="timer-circle">
                                <span>{auctionTimer}s</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="auction-pokemon">
                    <img src={auctionPokemon?.sprite} alt={auctionPokemon?.name} />
                    <h3>{auctionPokemon?.name}</h3>
                    <p>#{String(auctionPokemon?.id).padStart(3, '0')}</p>
                </div>
                <div className="bid-section">
                    <input
                        className="bid-input"
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="Tu puja (₽)"
                        min="1"
                        max={gameState?.players[socket.id]?.money || 1000}
                    />
                    <button 
                        className="btn-bid" 
                        onClick={handlePlaceBid}
                        disabled={!bidAmount || bidAmount <= 0}
                    >
                        💰 Pujar {bidAmount || '?'} ₽
                    </button>
                </div>
            </div>
        )}

        {/* Bid Results Reveal */}
        {showBidResults && bidResults && (
            <div className="bid-results-overlay">
                <div className="bid-results-container">
                    <div className="auction-pokemon-center">
                        <img src={bidResults.pokemon?.sprite} alt={bidResults.pokemon?.name} />
                        <h2>{bidResults.pokemon?.name}</h2>
                        <p>#{String(bidResults.pokemon?.id).padStart(3, '0')}</p>
                    </div>
                    
                    <div className="bids-reveal">
                        <div className="bid-card">
                            <div className="bid-player">
                                <h3>👤 Tú</h3>
                                <div className="bid-amount">
                                    <span className="currency">₽</span>
                                    <span className="amount" data-amount={bidResults?.playerBids?.[socket.id] || 0}>
                                        {bidResults?.playerBids?.[socket.id] || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="vs-divider">
                            <span>VS</span>
                        </div>
                        
                        <div className="bid-card">
                            <div className="bid-player">
                                <h3>🤖 Oponente</h3>
                                <div className="bid-amount">
                                    <span className="currency">₽</span>
                                    <span className="amount" data-amount={bidResults?.playerBids?.[Object.keys(bidResults?.playerBids || {}).find(id => id !== socket.id)] || 0}>
                                        {bidResults?.playerBids?.[Object.keys(bidResults?.playerBids || {}).find(id => id !== socket.id)] || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {revealWinner && (
                        <div className="winner-reveal">
                            <div className={`winner-announcement ${bidResults.winner === socket.id ? 'you-won' : 'opponent-won'}`}>
                                {bidResults.winner === socket.id ? (
                                    <>
                                        <h2>🎉 ¡GANASTE! 🎉</h2>
                                        <p>Te has llevado a {bidResults.pokemon?.name}</p>
                                    </>
                                ) : (
                                    <>
                                        <h2>😔 Perdiste</h2>
                                        <p>El oponente se llevó a {bidResults.pokemon?.name}</p>
                                    </>
                                )}
                                <div className="winning-bid">
                                    Puja ganadora: {bidResults.winningBid} ₽
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Game Over Screen */}
        {gameOver && (
            <div className="game-over">
                <h2>🎉 {message} 🎉</h2>
                <p>{gameOver}</p>
                <div style={{marginTop: '20px'}}>
                    <button className="btn-primary" onClick={() => window.location.reload()}>
                        🔄 Nueva Partida
                    </button>
                </div>
            </div>
        )}

        {/* Game State - Player Info */}
        {gameState && !gameOver && (
            <div className="game-state">
                {Object.entries(gameState.players).map(([id, data]) => (
                    <div 
                        key={id} 
                        className={`player-info ${id === socket.id ? 'current-player' : ''}`}
                    >
                        <h4>
                            {id === socket.id ? '👤 Tú' : '🤖 Oponente'}
                            <span style={{fontSize: '0.8rem', opacity: 0.7}}>
                                ({id.substring(0, 8)}...)
                            </span>
                        </h4>
                        <div className="money-display">
                            💰 {data.money} Pokédólares
                        </div>
                        <div className="team-section">
                            <h5 style={{marginBottom: '10px', color: '#4a5568'}}>
                                🎒 Equipo ({data.team.length}/8)
                            </h5>
                            <div className="team">
                                {data.team.map((p, i) => (
                                    <div key={i} className="team-pokemon" title={`${p.name} - #${p.id}`}>
                                        <img src={p.sprite} alt={p.name} />
                                    </div>
                                ))}
                                {/* Empty slots visualization */}
                                {Array.from({length: 8 - data.team.length}).map((_, i) => (
                                    <div key={`empty-${i}`} className="team-slot-empty">
                                        <div className="empty-indicator">?</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Turn Progress Indicator */}
        {gameState && !gameOver && (
            <div className="turn-progress">
                <div className="progress-bar">
                    <div 
                        className="progress-fill" 
                        style={{width: `${(gameState.turn / 16) * 100}%`}}
                    ></div>
                </div>
                <p>Ronda {Math.floor(gameState.turn / 2) + 1} de 8 - Turno {gameState.turn + 1}/16</p>
            </div>
        )}
    </div>
  );

  return (
    <div className="App">
      <h1>Pokémon Bet</h1>
      {!room || !gameState ? renderLobby() : renderGame()}
    </div>
  );
}

export default App;
