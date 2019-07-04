import React from 'react'
import ReactDOM from 'react-dom'
import { version } from '../package.json'
import './index.css'

import { UserHeader } from './components/UserHeader'
import { UserList } from './components/UserList'
import { MessageList } from './components/MessageList'
import { TypingIndicator } from './components/TypingIndicator'
import { CreateMessageForm } from './components/CreateMessageForm'
import { RoomList } from './components/RoomList'
import { RoomHeader } from './components/RoomHeader'
import { CreateRoomForm } from './components/CreateRoomForm'
import { WelcomeScreen } from './components/WelcomeScreen'
import { JoinRoomScreen } from './components/JoinRoomScreen'
import Gun from 'gun/gun'
import Sea from 'gun/sea'
import A from 'gun/lib/load'
import B from 'gun/lib/then'

import ChatManager from './chatkit'


// --------------------------------------
// Authentication
// --------------------------------------

window.localStorage.getItem('chatkit-user') &&
  !window.localStorage.getItem('chatkit-user').match(version) &&
  window.localStorage.clear()

const app_id = 'dori_app_36'
const global_room = 'global_room'
const params = new URLSearchParams(window.location.search.slice(1))
const authCode = params.get('code')
const existingUser = window.localStorage.getItem('chatkit-user')
const gun = Gun(['http://localhost:8765/gun']);

// --------------------------------------
// Application
// --------------------------------------

class View extends React.Component {
  state = {
    user: {
      rooms: {},
      roomSubscriptions: {},
      addPresence: (userId) => {
        return new Promise((resolve, reject) => {
          gun.get(app_id).get('userPresence').get('dori1').put(true)
          gun.get(app_id).get('userPresence').get(userId).put(true, (data) => {
            if (data.ok)
              resolve(data)
            else
              reject(data.err)
          })
        })
      },
      removePresence: (userId) => {
        if (this.state.user && this.state.user.id) {
          gun.get(app_id).get('userPresence').get(userId).put({ presence: false })
        }
      },
      isTypingIn: ({ roomId }) => {
        const { id } = this.state.user;
        gun.get(app_id).get('rooms').get(roomId).get('typings').get(id).put(true)
      },
      isNotTyping: ({ roomId }) => {
        const { id } = this.state.user;
        gun.get(app_id).get('rooms').get(roomId).get('typings').get(id).put(false)
      },
      sendMessage: ({ text, roomId }) => {
        const { avatarURL, id, name } = this.state.user;
        console.log(`sendMessage`)
        const randomId = Math.floor(Math.random() * 4294967296)
        const messageId = `${roomId}_${randomId}`
        gun.get(app_id).get('rooms').get(roomId).get('messages').get(messageId).put({ createdAt: new Date().toString(), text, id: messageId, sender: { avatarURL, id, name, presence: false } }, function (ack) { console.log(ack) })
      },
      setReadCursor: () => { return Promise.resolve(0) },
      subscribeToRooms: () => {
        gun.user().get('rooms').map().on((data, id) => {
          if (data)
            this.actions.subscribeToRoom({ id })
        })
      },
      loadUserPresence: (presentUser) => {
        return new Promise((resolve, reject) => {
          gun.get(app_id).get('userPresence').load((data) => {
            data[presentUser] = true
            this.setState({ userPresence: data }, resolve(data))
          })
        })
      },
      subscribeToRoom: ({ id: roomId }) => {
        const modifyUser = { ...this.state.user };
        console.log(`subscribeToRoom to ${roomId}`)

        gun.get(app_id).get('rooms').get(roomId).get('typings').map().on((data, id) => {
          if (id !== this.state.user.id) {
            if (data) {
              this.actions.isTyping({ id: roomId }, { id })
            } else {
              this.actions.notTyping({ id: roomId }, { id })
            }
          }
        })

        gun.get(app_id).get('rooms').get(roomId).on((data) => {
          const { id, isPrivate, name } = data
          const copyUser = { ...this.state.user }
          copyUser.rooms[roomId] = { id, isPrivate, name, users: {} };
          console.log(copyUser.rooms)
          this.actions.setUser(copyUser);

          if (Object.keys(this.state.room).length === 0 && this.state.user.rooms && this.state.user.rooms[global_room]) {
            this.actions.setRoom(this.state.user.rooms[global_room])
          }
        })

        gun.get(app_id).get('rooms').get(roomId).get('users').map().on((data) => {
          const { avatarURL, id, name } = data
          const copyUser = { ...this.state.user }
          const presence = this.state.userPresence[id] ? this.state.userPresence[id] : false
          console.log(`append ${id} presence to ${presence}`)
          copyUser.rooms[roomId].users[id] = { avatarURL, id, name, presence };
          this.actions.setUser(copyUser);
        })

        gun.get(app_id).get('rooms').get(roomId).get('messages').map().on((data) => {
          console.log(`subscribeToRoom to ${roomId} messages`)
          const { id, text, createdAt, sender } = data
          const message = { id, text, createdAt, sender, room: this.state.user.rooms[roomId] }
          gun.get(app_id).get('rooms').get(roomId).get('messages').get(data.id).get('sender').once((senderData) => {
            const { avatarURL, id, name } = senderData
            const presence = this.state.userPresence[id] ? this.state.userPresence[id] : false
            message.sender = { avatarURL, id, name, presence }
            console.log(`append message ${text} presence to ${presence}`)
            console.log({ userPresence: this.state.userPresence, id })
            this.actions.addMessage(message)
          })
        })
        modifyUser.roomSubscriptions[roomId] = true
      },
    },
    userPresence: {},
    room: {},
    messages: {},
    typing: {},
    sidebarOpen: false,
    userListOpen: window.innerWidth > 1000,
  }

  actions = {
    subscribeToUserPresence: () => {
      gun.get(app_id).get('userPresence').on((data, id) => {
        delete data['userPresence']
        const copyUserPresence = { ...this.state.userPresence }
        copyUserPresence[id] = data
        this.setState({ userPresence: copyUserPresence })
      })
    },


    setPresenceList: (userId, presence) => {
      console.log({ action: 'setPresenceList', userId, presence })
      const copyUserPresence = { ...this.state.userPresence }
      copyUserPresence[userId] = presence
      this.setState({ userPresence: copyUserPresence });
    },

    // --------------------------------------
    // UI
    // --------------------------------------

    setSidebar: sidebarOpen => this.setState({ sidebarOpen }),
    setUserList: userListOpen => this.setState({ userListOpen }),

    // --------------------------------------
    // User
    // --------------------------------------

    setUser: (user) => {
      this.setState({ user: { ...this.state.user, ...user } })
    },

    concatRoom: (rooms) => {
      this.setState({ user: { ...this.state.user, rooms: [...new Set([...this.state.user.rooms || [], ...rooms])] } })
    },

    concatMessages: (messages) => {
      console.log(messages)
      this.setState({ messages: { ...this.state.messages, ...messages } })
    },

    // --------------------------------------
    // Room
    // --------------------------------------

    setRoom: room => {
      this.setState({ room, sidebarOpen: false })
      this.actions.scrollToEnd()
    },

    removeRoom: room => this.setState({ room: {} }),

    joinRoom: room => {
      this.actions.setRoom(room)
      this.actions.subscribeToRoom(room)
      this.state.messages[room.id] &&
        this.actions.setCursor(
          room.id,
          Object.keys(this.state.messages[room.id]).pop()
        )
    },


    getUserRooms: () => this.state.user.getRooms(),


    subscribeToUserRooms: () => this.state.user.subscribeToRooms(),

    subscribeToRoom: room =>
      !this.state.user.roomSubscriptions[room.id] &&
      this.state.user.subscribeToRoom(room),

    createRoom: options => {
      console.log(options)
      const randomId = Math.floor(Math.random() * 4294967296)
      const roomId = `${gun.user().is.alias}_${randomId}`
      const users = {}
      users[gun.user().is.alias] = { id: gun.user().is.alias, avatarURL: `https://robohash.org/${gun.user().is.alias}`, name: gun.user().is.alias, presence: true }
      gun.get(app_id).get('rooms').get(roomId).put({ name: options.name, id: roomId, isPrivate: options.private, users })
      const rooms = {}
      rooms[roomId] = true
      gun.user().get('rooms').put(rooms);
    },


    createConvo: options => {
      if (options.user.id !== this.state.user.id) {
        const exists = Object.keys(this.state.user.rooms).map(key => this.state.user.rooms[key]).find(
          x =>
            x.name === options.user.id + this.state.user.id ||
            x.name === this.state.user.id + options.user.id
        )
        exists
          ? this.actions.joinRoom(exists)
          : this.actions.createRoom({
            name: this.state.user.id + options.user.id,
            addUserIds: [options.user.id],
            private: true,
          })
      }
    },

    addUserToRoom: ({ userId, roomId = this.state.room.id }) =>
      this.state.user
        .addUserToRoom({ userId, roomId })
        .then(this.actions.setRoom),

    removeUserFromRoom: ({ userId, roomId = this.state.room.id }) =>
      userId === this.state.user.id
        ? this.state.user.leaveRoom({ roomId })
        : this.state.user
          .removeUserFromRoom({ userId, roomId })
          .then(this.actions.setRoom),

    // --------------------------------------
    // Cursors
    // --------------------------------------

    setCursor: (roomId, position) =>
      this.state.user
        .setReadCursor({ roomId, position: parseInt(position) })
        .then(x => this.forceUpdate()),

    // --------------------------------------
    // Messages
    // --------------------------------------

    addMessage: payload => {
      const roomId = payload.room.id
      const messageId = payload.id
      // Update local message cache with new message
      this.setState(prevState => ({
        messages: {
          ...prevState.messages,
          [roomId]: {
            ...prevState.messages[roomId],
            [messageId]: payload
          }
        }
      }))
      // Update cursor if the message was read
      if (roomId === this.state.room.id) {
        //const cursor = this.state.user.readCursor({ roomId }) || {}
        //const cursorPosition = cursor.position || 0
        //cursorPosition < messageId && this.actions.setCursor(roomId, messageId)
        this.actions.scrollToEnd()
      }
      // Send notification
      const isFreeshMessage = new Date(payload.createdAt).getTime() > new Date(new Date().getTime() - 2000)
      if (isFreeshMessage)
        this.actions.showNotification(payload)
    },

    runCommand: command => {
      const commands = {
        invite: ([userId]) => this.actions.addUserToRoom({ userId }),
        remove: ([userId]) => this.actions.removeUserFromRoom({ userId }),
        leave: ([userId]) =>
          this.actions.removeUserFromRoom({ userId: this.state.user.id }),
      }
      const name = command.split(' ')[0]
      const args = command.split(' ').slice(1)
      const exec = commands[name]
      exec && exec(args).catch(console.log)
    },

    scrollToEnd: e =>
      setTimeout(() => {
        const elem = document.querySelector('#messages')
        elem && (elem.scrollTop = 100000)
      }, 0),

    // --------------------------------------
    // Typing Indicators
    // --------------------------------------

    isTyping: (room, user) => {
      this.setState(prevState => ({
        typing: {
          ...prevState.typing,
          [room.id]: {
            ...prevState.typing[room.id],
            [user.id]: true
          }
        }
      }))
    },

    notTyping: (room, user) => {
      const copyTyping = { ...this.state.typing }
      if (copyTyping[room.id] && copyTyping[room.id][user.id]) {
        delete copyTyping[room.id][user.id]
        this.setState({ typing: copyTyping })
      }
    },

    // --------------------------------------
    // Presence
    // --------------------------------------

    setUserPresence: () => this.forceUpdate(),

    // --------------------------------------
    // Notifications
    // --------------------------------------

    showNotification: message => {
      if (
        'Notification' in window &&
        this.state.user.id &&
        this.state.user.id !== message.senderId &&
        document.visibilityState === 'hidden'
      ) {
        const notification = new Notification(
          `New Message from ${message.sender.id}`,
          {
            body: message.text,
            icon: message.sender.avatarURL,
          }
        )
        notification.addEventListener('click', e => {
          this.actions.joinRoom(message.room)
          window.focus()
        })
      }
    },
  }

  setupBeforeUnloadListener = (userId) => {
    window.addEventListener("beforeunload", (ev) => {
      ev.preventDefault();
      this.state.user.removePresence(userId);
    });
  };
  control = false

  async componentDidMount() {
    'Notification' in window && Notification.requestPermission()
    const user = await gunAskUsernameAndPassword();
    const presence = await this.state.user.addPresence(user.id)
    const usersConnected = await this.state.user.loadUserPresence(user.id)
    console.log({ usersConnected })



    this.actions.setUser(user)
    this.actions.subscribeToUserRooms(user.id);
    this.actions.subscribeToUserPresence();
    //this.setupBeforeUnloadListener(user.id)
    this.state.user.addPresence()

    //const rooms = await this.state.user.loadRooms()
    //console.log(rooms)
    // this.state.user.setPresence()

    //roomListener(this.actions.concatRoom, this.actions.concatMessages)

    //globalRoomListener(this.actions.concatRoom)

    // existingUser
    //   ? ChatManager(this, JSON.parse(existingUser))
    //   : fetch('https://chatkit-demo-server.herokuapp.com/auth', {
    //     method: 'POST',
    //     body: JSON.stringify({ code: authCode }),
    //   })
    //     .then(res => res.json())
    //     .then(user => {
    //       user.version = version
    //       window.localStorage.setItem('chatkit-user', JSON.stringify(user))
    //       window.history.replaceState(null, null, window.location.pathname)
    //       ChatManager(this, user)
    //     })
  }

  render() {
    const {
      user,
      room,
      messages,
      typing,
      sidebarOpen,
      userListOpen,
    } = this.state
    const { createRoom, createConvo, removeUserFromRoom } = this.actions

    return (
      <main>
        <aside data-open={sidebarOpen}>
          <UserHeader user={user} />
          <RoomList
            user={user}
            rooms={user.rooms}
            messages={messages}
            typing={typing}
            current={room}
            actions={this.actions}
          />
          {user.id && <CreateRoomForm submit={createRoom} />}
        </aside>
        <section>
          <RoomHeader state={this.state} actions={this.actions} />
          {room.id ? (
            <row->
              <col->
                <MessageList
                  user={user}
                  messages={messages[room.id]}
                  createConvo={createConvo}
                />
                <TypingIndicator typing={typing[room.id]} />
                <CreateMessageForm state={this.state} actions={this.actions} />
              </col->
              {userListOpen && (
                <UserList
                  room={room}
                  current={user.id}
                  createConvo={createConvo}
                  removeUser={removeUserFromRoom}
                />
              )}
            </row->
          ) : user.id ? (
            <JoinRoomScreen />
          ) : (
                <WelcomeScreen />
              )}
        </section>
      </main>
    )
  }
}

const gunAskUsernameAndPassword = async (setUser) => {
  const user = gun.user();
  const users = ['dori1', 'dori2', 'dori3'];
  var item = users[Math.floor(Math.random() * users.length)];

  const username = item // window.prompt('username', 'dori66')
  const password = item // window.prompt('password', 'dori66') 

  return new Promise((resolve, reject) => {
    gun.user().create(username, password, function (createcbk) {
      gun.user().auth(username, password, function (authcbk) {
        if (authcbk['err'])
          alert(authcbk['err'])
        else {
          window.localStorage.setItem('chatkit-user', JSON.stringify({ id: user.is.alias, version, pub: user.is.pub }));
          /**
           * create glogal room
           */
          gun.user().get('rooms').put({ global_room: true });
          gun.get(app_id).get('rooms').get(global_room).put({ name: 'Global', id: global_room, isPrivate: false, users: {} })
          gun.get(app_id).get('rooms').get(global_room).get('users').get(gun.user().is.alias).put({ id: gun.user().is.alias, avatarURL: `https://robohash.org/${gun.user().is.alias}`, name: gun.user().is.alias, presence: true }, function (ack) {
            resolve({
              id: user.is.alias,
              name: user.is.alias,
              avatarURL: `https://robohash.org/${gun.user().is.alias}`,
              presence: true,
              version,
              pub: user.is.pub,
              readCursor: {},
            })
          });
        }
      })
    });
  });
}



ReactDOM.render(<View />, document.querySelector('#root'))
