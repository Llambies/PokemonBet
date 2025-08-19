import { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";

const URL = import.meta.env.DEV ? "http://localhost:3001" : "";
const socket = io(URL);

function App() {
  const [room, setRoom] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [message, setMessage] = useState("");
  const [gameState, setGameState] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pokemonOptions, setPokemonOptions] = useState([]);
  const [auctionPokemon, setAuctionPokemon] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [inAuction, setInAuction] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auctionTimer, setAuctionTimer] = useState(null);
  const [showBidResults, setShowBidResults] = useState(false);
  const [bidResults, setBidResults] = useState(null);
  const [revealWinner, setRevealWinner] = useState(false);

  useEffect(() => {
    socket.on("connect", () => console.log("Connected to server"));
    socket.on("roomCreated", (roomID) => {
      setRoom(roomID);
      setMessage(`Has creado la sala: ${roomID}`);
    });
    socket.on("roomJoined", (roomID) => {
      setRoom(roomID);
      setMessage(`Te has unido a la sala: ${roomID}`);
    });
    socket.on("playerJoined", () => setMessage("Otro jugador se ha unido."));
    socket.on("roomFull", () => setMessage("La sala está llena."));

    socket.on("gameStart", (initialGameState) => {
      setGameState(initialGameState);
      setMessage("¡El juego ha comenzado!");
    });

    socket.on("yourTurn", (options) => {
      setLoading(false);
      setIsMyTurn(true);
      setPokemonOptions(options);
      setInAuction(false);
      setMessage("¡Es tu turno! Elige un Pokémon para subastar.");
    });

    socket.on("waitingForOpponent", () => {
      setIsMyTurn(false);
      setLoading(true);
      setMessage("Esperando a que el oponente elija un Pokémon...");
    });

    socket.on("auctionStart", (pokemon) => {
      setLoading(false);
      setAuctionPokemon(pokemon);
      setPokemonOptions([]);
      setIsMyTurn(false);
      setInAuction(true);
      setAuctionTimer(30); // 30 second timer for auction
      setMessage(`¡Subasta iniciada! Puja por ${pokemon.name}`);
    });

    socket.on("auctionReveal", ({ winner, winningBid, pokemon, bids }) => {
      // Show bid results first
      setBidResults({
        winner,
        winningBid,
        pokemon,
        playerBids: bids,
      });
      setShowBidResults(true);
      setInAuction(false);
      setAuctionTimer(null);

      // Lock body scroll when modal opens
      document.body.classList.add("modal-open");

      // Reveal winner after 2 seconds
      setTimeout(() => {
        setRevealWinner(true);
        const winnerMsg =
          winner === socket.id
            ? "¡Ganaste la subasta!"
            : "El oponente ganó la subasta";
        setMessage(
          `${winnerMsg} - Se llevó a ${pokemon.name} por ${winningBid} ₽`
        );
      }, 2000);
    });

    socket.on(
      "auctionResult",
      ({ gameState: newGameState, message: resultMessage }) => {
        // Update game state after animation
        setGameState(newGameState);
        setMessage(resultMessage);

        // Hide animation and unlock body scroll
        setShowBidResults(false);
        setBidResults(null);
        setRevealWinner(false);
        setAuctionPokemon(null);
        document.body.classList.remove("modal-open");
      }
    );

    socket.on("gameOver", (finalGameState) => {
      setGameState(finalGameState);
      const endMessage = "¡El draft ha terminado! Este es tu equipo final.";
      setGameOver(endMessage);
      setMessage("¡Juego terminado!");
    });

    socket.on("playerLeft", () =>
      setMessage("El otro jugador ha abandonado la sala.")
    );

    return () => {
      socket.off("connect");
      socket.off("roomCreated");
      socket.off("roomJoined");
      socket.off("playerJoined");
      socket.off("roomFull");
      socket.off("gameStart");
      socket.off("yourTurn");
      socket.off("waitingForOpponent");
      socket.off("auctionStart");
      socket.off("auctionReveal");
      socket.off("auctionResult");
      socket.off("gameOver");
      socket.off("playerLeft");

      // Cleanup modal class on unmount
      document.body.classList.remove("modal-open");
    };
  }, [room]);

  // Auction timer effect
  useEffect(() => {
    let interval = null;
    if (auctionTimer > 0 && inAuction) {
      interval = setInterval(() => {
        setAuctionTimer((timer) => timer - 1);
      }, 1000);
    } else if (auctionTimer === 0 && inAuction) {
      setAuctionTimer(null);
      // Automatically place bid when timer reaches 0
      const autoBid = parseInt(bidAmount, 10) || 0; // Use 0 if no bid amount entered
      socket.emit("placeBid", { roomID: room, bid: autoBid });
      setBidAmount("");
      setInAuction(false);
      setMessage("Tiempo agotado. Puja automática realizada: " + autoBid + " ₽");
    }
    return () => clearInterval(interval);
  }, [auctionTimer, inAuction, bidAmount, room]);

  // ESC key to close modal (accessibility)
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === "Escape" && showBidResults) {
        // Force close modal if ESC is pressed
        setShowBidResults(false);
        setBidResults(null);
        setRevealWinner(false);
        document.body.classList.remove("modal-open");
      }
    };

    if (showBidResults) {
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [showBidResults]);

  useEffect(() => {
    if (bidAmount) {
      if (bidAmount > gameState?.players[socket.id]?.money) {
        setBidAmount(gameState?.players[socket.id]?.money);
      }
    }
  }, [bidAmount, gameState]);

  const handleJoinRoom = () => {
    if (roomInput.trim() !== "") socket.emit("joinRoom", roomInput);
  };

  const handleSelectPokemon = (pokemon) => {
    setLoading(true);
    setMessage(
      `Has elegido a ${pokemon.name} para subastar. Iniciando subasta...`
    );
    socket.emit("pokemonSelected", { roomID: room, pokemon });
    setPokemonOptions([]);
    setIsMyTurn(false);
  };

  const handlePlaceBid = () => {
    const bid = parseInt(bidAmount, 10);
    if (!isNaN(bid) && bid >= 0) {
      socket.emit("placeBid", { roomID: room, bid });
      setBidAmount("");
      setInAuction(false); // Disable bidding after placing one
      setMessage("Puja realizada. Esperando al oponente...");
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
      <p style={{ marginBottom: "20px", color: "#718096" }}>
        Introduce un ID de sala para unirte a una partida existente o crear una
        nueva
      </p>
      <input
        className="lobby-input"
        type="text"
        placeholder="Ej: sala123"
        value={roomInput}
        onChange={(e) => setRoomInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
      />
      <button
        className="btn-primary"
        onClick={handleJoinRoom}
        disabled={!roomInput.trim()}
      >
        {roomInput.trim() ? "🚀 Unirse/Crear Sala" : "🎯 Introduce un ID"}
      </button>
    </div>
  );

  const renderGame = () => (
    <div className="game-container">
      {/* Room Info Header */}

      <div className="room-info-container">
        <div className="room-info">
          <h2>🏟️ Sala: {room}</h2>
        </div>
        {/* Message Display */}
        {message && <div className="message-display">{message}</div>}
      </div>

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
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <img src={p.sprite} alt={p.name} />
                <div className="pokemon-id">
                  {p.name.toUpperCase()} #{String(p.id).padStart(3, "0")}
                </div>
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
            <p>#{String(auctionPokemon?.id).padStart(3, "0")}</p>
          </div>
          <div className="bid-section">
            <input
              className="bid-input"
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="Tu puja (₽)"
              min="0"
              max={gameState?.players[socket.id]?.money || 1000}
            />
            <button
              className="btn-bid"
              onClick={handlePlaceBid}
              disabled={!bidAmount || bidAmount < 0}
            >
              💰 Pujar {bidAmount || "?"} ₽
            </button>
          </div>
        </div>
      )}

      {/* Bid Results Reveal - Enhanced Animation Modal */}
      {showBidResults && bidResults && (
        <div
          className="bid-results-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auction-results-title"
          tabIndex={-1}
        >
          <div className="bid-results-container">
            {/* Header with Pokemon and Title */}
            <div className="reveal-header">
              <h1 id="auction-results-title" className="reveal-title">
                🎯 RESULTADO DE LA SUBASTA 🎯
              </h1>
              <div className="auction-pokemon-showcase">
                <img
                  src={bidResults.pokemon?.sprite}
                  alt={bidResults.pokemon?.name}
                />
                <div className="pokemon-info">
                  <h2>{bidResults.pokemon?.name}</h2>
                  <p>#{String(bidResults.pokemon?.id).padStart(3, "0")}</p>
                </div>
              </div>
            </div>

            {/* Bids Comparison */}
            <div className="bids-comparison">
              <div className="comparison-title">
                <h3>💰 PUJAS REVELADAS 💰</h3>
              </div>

              <div className="bids-reveal-enhanced">
                <div
                  className={`bid-card-enhanced player-card ${
                    bidResults.winner === socket.id
                      ? "winning-card"
                      : "losing-card"
                  }`}
                >
                  <div className="player-avatar">👤</div>
                  <div className="player-info">
                    <h3>TÚ</h3>
                    <div className="bid-display">
                      <div className="bid-label">Tu Puja:</div>
                      <div className="bid-amount-large">
                        <span className="currency-large">₽</span>
                        <span className="amount-large">
                          {bidResults?.playerBids?.[socket.id] || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  {bidResults.winner === socket.id && (
                    <div className="winner-badge">
                      <span>👑 GANADOR</span>
                    </div>
                  )}
                </div>

                <div className="vs-divider-enhanced">
                  <div className="vs-circle">
                    <span>VS</span>
                  </div>
                </div>

                <div
                  className={`bid-card-enhanced opponent-card ${
                    bidResults.winner !== socket.id
                      ? "winning-card"
                      : "losing-card"
                  }`}
                >
                  <div className="player-avatar">🤖</div>
                  <div className="player-info">
                    <h3>OPONENTE</h3>
                    <div className="bid-display">
                      <div className="bid-label">Su Puja:</div>
                      <div className="bid-amount-large">
                        <span className="currency-large">₽</span>
                        <span className="amount-large">
                          {bidResults?.playerBids?.[
                            Object.keys(bidResults?.playerBids || {}).find(
                              (id) => id !== socket.id
                            )
                          ] || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  {bidResults.winner !== socket.id && (
                    <div className="winner-badge">
                      <span>👑 GANADOR</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Winner Announcement - Appears after delay */}
            {revealWinner && (
              <div className="final-result">
                <div
                  className={`result-announcement ${
                    bidResults.winner === socket.id ? "victory" : "defeat"
                  }`}
                >
                  {bidResults.winner === socket.id ? (
                    <>
                      <div className="result-icon">🎉</div>
                      <h2>¡FELICIDADES!</h2>
                      <p>Has ganado la subasta</p>
                      <div className="pokemon-acquired">
                        <img
                          src={bidResults.pokemon?.sprite}
                          alt={bidResults.pokemon?.name}
                        />
                        <div className="acquisition-text">
                          <strong>{bidResults.pokemon?.name}</strong> se une a
                          tu equipo
                        </div>
                      </div>
                      <div className="cost-display">
                        Costo: <strong>{bidResults.winningBid} ₽</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="result-icon">😔</div>
                      <h2>Subasta Perdida</h2>
                      <p>El oponente ha ganado</p>
                      <div className="pokemon-lost">
                        <img
                          src={bidResults.pokemon?.sprite}
                          alt={bidResults.pokemon?.name}
                        />
                        <div className="loss-text">
                          <strong>{bidResults.pokemon?.name}</strong> va al
                          equipo rival
                        </div>
                      </div>
                      <div className="cost-display">
                        Puja ganadora:{" "}
                        <strong>{bidResults.winningBid} ₽</strong>
                      </div>
                    </>
                  )}
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

          {gameState.players[socket.id].team.map((p) => (
            <div className="game-over-pokemon">
              <img src={p.miniatura} alt={p.name} />
              <h3>{p.name}</h3>
              <p>#{String(p.id).padStart(3, "0")}</p>
            </div>
          ))}

          <div style={{ marginTop: "20px" }}>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
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
              className={`player-info ${
                id === socket.id ? "current-player" : ""
              }`}
            >
              <h4>
                {id === socket.id ? "👤 Tú" : "🤖 Oponente"}
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                  ({id.substring(0, 8)}...)
                </span>
              </h4>
              <div className="money-display">💰 {data.money} Pokédólares</div>
              <div className="team-section">
                <h5 style={{ marginBottom: "10px", color: "#4a5568" }}>
                  🎒 Equipo ({data.team.length}/8)
                </h5>
                <div className="team">
                  {data.team.map((p, i) => (
                    <div
                      key={i}
                      className="team-pokemon"
                      title={`${p.name} - #${p.id}`}
                    >
                      <img src={p.miniatura} alt={p.name} />
                    </div>
                  ))}
                  {/* Empty slots visualization */}
                  {Array.from({ length: 8 - data.team.length }).map((_, i) => (
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
              style={{ width: `${(gameState.turn / 16) * 100}%` }}
            ></div>
          </div>
          <p>
            Ronda {Math.floor(gameState.turn / 2) + 1} de 8 - Turno{" "}
            {gameState.turn + 1}/16
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="App">
      {!room || !gameState ? renderLobby() : renderGame()}
    </div>
  );
}

export default App;
