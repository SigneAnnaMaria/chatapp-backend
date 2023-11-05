const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')

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
const roomMessages = { Lobby: [] }
const roomsUsersMap = {}
const socketUserMap = {}

io.on('connection', (socket) => {
  socket.emit('rooms_list', rooms)

  socket.on('get_rooms_list', () => {
    socket.emit('rooms_list', rooms)
  })

  socket.on('create_room', (roomName) => {
    if (!rooms.includes(roomName)) {
      rooms.push(roomName)
      roomMessages[roomName] = []
      io.emit('rooms_list', rooms)
    }
  })

  socket.on('join_room', (data) => {
    const roomId = data.roomId
    const username = data.username

    if (!roomsUsersMap[roomId]) {
      roomsUsersMap[roomId] = []
    }
    roomsUsersMap[roomId].push(username)
    socket.join(roomId)
  })

  socket.on('leave_room', (data) => {
    const { roomId, username } = data
    if (roomsUsersMap[roomId]) {
      roomsUsersMap[roomId] = roomsUsersMap[roomId].filter(
        (user) => user !== username
      )
      socket.leave(roomId)
    }
  })

  socket.on('send_message', (data) => {
    const room = data.room
    const messageContent = {
      username: data.username,
      text: data.message,
      room: data.room,
    }
    if (!roomMessages[room]) {
      roomMessages[room] = []
    }
    roomMessages[room].push(messageContent)
    io.to(room).emit('receive_message', messageContent)
  })

  socket.on('disconnect', () => {
    const username = socketUserMap[socket.id]
    delete socketUserMap[socket.id]
    for (const roomId in roomsUsersMap) {
      roomsUsersMap[roomId] = roomsUsersMap[roomId].filter(
        (user) => user !== username
      )
    }
  })
})

server.listen(3001, () => {
  console.log('backend running')
})
