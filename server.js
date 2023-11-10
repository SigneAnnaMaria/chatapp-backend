const express = require('express')
const http = require('http')
const socketIo = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

let rooms = ['Lobby']
const usersInRooms = {}
const roomMessages = { Lobby: [] }
const userRoomVisitation = {}
const socketUserMap = {}

io.on('connection', (socket) => {
  socket.emit('rooms_list', rooms)

  socket.on('get_rooms_list', () => {
    socket.emit('rooms_list', rooms)
  })

  socket.on('create_room', (roomName, callback) => {
    if (!rooms.includes(roomName)) {
      rooms.push(roomName)
      roomMessages[roomName] = []
      io.emit('rooms_list', rooms)
      callback({ roomCreated: true, roomName: roomName })
    } else {
      callback({ roomCreated: false })
    }
  })

  socket.on('join_room', (data) => {
    const { roomId, username } = data
    userRoomVisitation[username] = userRoomVisitation[username] || new Set()
    userRoomVisitation[username].add(roomId)
    socketUserMap[socket.id] = username

    if (!usersInRooms[roomId]) {
      usersInRooms[roomId] = new Set()
    }
    usersInRooms[roomId].add(username)

    socket.join(roomId)
    io.to(roomId).emit('users_list', Array.from(usersInRooms[roomId]))
  })

  socket.on('leave_room', (data) => {
    const { roomId, username } = data

    if (usersInRooms[roomId] && usersInRooms[roomId].has(username)) {
      usersInRooms[roomId].delete(username)

      if (usersInRooms[roomId].size === 0) {
        if (roomId !== 'Lobby') {
          deleteRoom(roomId)
        } else {
          delete usersInRooms[roomId]
        }
      } else {
        io.to(roomId).emit('users_list', Array.from(usersInRooms[roomId]))
      }
    }

    if (userRoomVisitation[username]) {
      userRoomVisitation[username].delete(roomId)
      if (userRoomVisitation[username].size === 0) {
        delete userRoomVisitation[username]
      }
    }
  })

  socket.on('send_message', (data) => {
    const { room, username, message } = data
    const messageContent = { username, text: message, room }

    if (!roomMessages[room]) {
      roomMessages[room] = []
    }
    roomMessages[room].push(messageContent)

    io.to(room).emit('receive_message', messageContent)

    Object.entries(userRoomVisitation).forEach(([user, visitedRooms]) => {
      if (visitedRooms.has(room) && user !== username) {
        const userSockets = Object.entries(socketUserMap)
          .filter(([_, userOfSocket]) => userOfSocket === user)
          .map(([socketId]) => socketId)

        userSockets.forEach((socketId) => {
          const currentRooms = Array.from(
            io.sockets.sockets.get(socketId)?.rooms || []
          )
          if (!currentRooms.includes(room)) {
            io.to(socketId).emit('receive_message', messageContent)
          }
        })
      }
    })
  })

  socket.on('disconnect', () => {
    const username = socketUserMap[socket.id]
    if (username) {
      Object.keys(usersInRooms).forEach((roomId) => {
        if (usersInRooms[roomId].has(username)) {
          usersInRooms[roomId].delete(username)
          if (roomId !== 'Lobby' && usersInRooms[roomId].size === 0) {
            deleteRoom(roomId)
          } else {
            io.to(roomId).emit('users_list', Array.from(usersInRooms[roomId]))
          }
        }
      })

      if (userRoomVisitation[username]) {
        userRoomVisitation[username].forEach((roomId) => {
          userRoomVisitation[username].delete(roomId)
        })
        delete userRoomVisitation[username]
      }

      delete socketUserMap[socket.id]
    }
  })
})

function deleteRoom(roomId) {
  rooms = rooms.filter((room) => room !== roomId)
  delete roomMessages[roomId]
  io.emit('rooms_list', rooms)
  io.emit('delete-room', roomId)
}

function getRoomUsers(roomId) {
  return usersInRooms[roomId] ? Array.from(usersInRooms[roomId]) : []
}

server.listen(3001, () => {
  console.log('Server is running and listening on port 3001')
})
