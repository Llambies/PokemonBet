const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

const rooms = {};
const POKEAPI_URL = 'https://pokeapi.co/api/v2/pokemon/';

const getPokemon = async () => {
  try {
    const randomIds = Array.from({ length: 3 }, () => Math.floor(Math.random() * 1024) + 1);
    const requests = randomIds.map(id => axios.get(`${POKEAPI_URL}${id}`));
    const responses = await Promise.all(requests);

    return responses.map(res => (
      {
        id: res.data.id,
        name: res.data.name,
        sprite: res.data.sprites.other['official-artwork'].front_default,
      }));
  } catch (error) {
    console.error('Error fetching Pokémon:', error);
    return [];
  }
};


io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('joinRoom', (roomID) => {
    if (!rooms[roomID]) {
      rooms[roomID] = {
        players: [socket.id],
      };
      socket.join(roomID);
      socket.emit('roomCreated', roomID);
      console.log(`Room ${roomID} created by ${socket.id}`);
    } else if (rooms[roomID].players.length < 2) {
      rooms[roomID].players.push(socket.id);
      socket.join(roomID);
      socket.emit('roomJoined', roomID);
      io.to(roomID).emit('playerJoined', socket.id);
      console.log(`${socket.id} joined room ${roomID}`);

      if (rooms[roomID].players.length === 2) {
        const room = rooms[roomID];
        room.gameState = {
          turn: 0,
          players: {
            [room.players[0]]: { money: 1000, team: [] },
            [room.players[1]]: { money: 1000, team: [] },
          },
          currentPokemon: null,
          bids: {},
        };
        io.to(roomID).emit('gameStart', room.gameState);
        console.log(`Game started in room ${roomID}`);
        startTurn(roomID);
      }
    } else {
      socket.emit('roomFull');
      console.log(`Room ${roomID} is full`);
    }
  });

  const startTurn = async (roomID) => {
    const room = rooms[roomID];
    if (!room || !room.gameState) return;

    const currentPlayerId = room.players[room.gameState.turn % 2];
    const pokemonOptions = await getPokemon();
    room.gameState.pokemonOptions = pokemonOptions;
    io.to(currentPlayerId).emit('yourTurn', pokemonOptions);
    // Notify other player
    const otherPlayerId = room.players[(room.gameState.turn + 1) % 2];
    io.to(otherPlayerId).emit('waitingForOpponent', { opponent: currentPlayerId });
  };

  socket.on('pokemonSelected', ({ roomID, pokemon }) => {
    const room = rooms[roomID];
    if (room && room.gameState) {
      room.gameState.currentPokemon = pokemon;
      room.gameState.bids = {};
      io.to(roomID).emit('auctionStart', pokemon);
    }
  });

  socket.on('placeBid', ({ roomID, bid }) => {
    const room = rooms[roomID];
    if (room && room.gameState) {
      room.gameState.bids[socket.id] = bid;
      if (Object.keys(room.gameState.bids).length === 2) {
        // Both players have bid, resolve the auction
        resolveAuction(roomID);
      }
    }
  });

  const resolveAuction = (roomID) => {
    const room = rooms[roomID];
    if (!room || !room.gameState || Object.keys(room.gameState.bids).length !== 2) return;

    const [player1, player2] = room.players;
    const bid1 = room.gameState.bids[player1];
    const bid2 = room.gameState.bids[player2];
    const pokemon = room.gameState.currentPokemon;

    let winner, winningBid;

    if (bid1 > bid2) {
      winner = player1;
      winningBid = bid1;
    } else if (bid2 > bid1) {
      winner = player2;
      winningBid = bid2;
    } else {
      // Tie-break: randomly choose a winner
      winner = Math.random() < 0.5 ? player1 : player2;
      winningBid = bid1;
    }

    // Show the animation first
    io.to(roomID).emit('auctionReveal', {
      bids: room.gameState.bids,
      winner,
      winningBid,
      pokemon
    });

    // After animation delay, update game state and continue
    setTimeout(() => {
      room.gameState.players[winner].money -= winningBid;
      room.gameState.players[winner].team.push(pokemon);

      const winnerMsg = winner === player1 ? 'El jugador 1 ganó la subasta' : 'El jugador 2 ganó la subasta';

      // Reset auction state
      room.gameState.currentPokemon = null;
      room.gameState.bids = {};
      room.gameState.turn++;

      // Send updated game state
      io.to(roomID).emit('auctionResult', {
        winner,
        winningBid,
        pokemon,
        gameState: room.gameState,
        message: `${winnerMsg}. Se llevó a ${pokemon.name} por ${winningBid} ₽`
      });

      // Check if game is over or continue to next turn
      if (room.gameState.turn >= 16) {
        io.to(roomID).emit('gameOver', room.gameState);
        delete rooms[roomID];
      } else {
        // Start next turn after a brief delay
        setTimeout(() => {
          startTurn(roomID);
        }, 1000);
      }
    }, 5500); // Wait for animation to complete
  };

  // The "catchall" handler: for any request that doesn't
  // match one above, send back React's index.html file.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    for (const roomID in rooms) {
      const room = rooms[roomID];
      const playerIndex = room.players.indexOf(socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomID).emit('playerLeft', socket.id);
        console.log(`${socket.id} left room ${roomID}`);
        if (room.players.length === 0) {
          delete rooms[roomID];
          console.log(`Room ${roomID} is empty and has been deleted`);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
