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

import ChatManager from './chatkit'

// --------------------------------------
// Application
// --------------------------------------

class View extends React.Component {
  state = {
    user: {},
    room: {},
    messages: {},
    typing: {},
    sidebarOpen: false,
    userListOpen: window.innerWidth > 1000,
  }

  actions = {
    // --------------------------------------
    // UI
    // --------------------------------------

    setSidebar: sidebarOpen => this.setState({ sidebarOpen }),
    setUserList: userListOpen => this.setState({ userListOpen }),

    // --------------------------------------
    // User
    // --------------------------------------

    setUser: (user) => {
      this.setState({ user })
    },


    concatRoom: (rooms) => {
      this.setState({ user: {...this.state.user, rooms: [...new Set([...this.state.user.rooms || [] ,...rooms])]}})
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
      //this.actions.subscribeToRoom(room)
      this.state.messages[room.id] &&
        this.actions.setCursor(
          room.id,
          Object.keys(this.state.messages[room.id]).pop()
        )
    },

    subscribeToRoom: room =>
      !this.state.user.roomSubscriptions[room.id] &&
      this.state.user.subscribeToRoom({
        roomId: room.id,
        hooks: { onMessage: this.actions.addMessage },
      }),

    createRoom: options => {
      console.log(options)
      const randomId = Math.floor(Math.random() * 4294967296)
      const roomId = `${gun.user().is.alias}_${randomId}`
      gun.get(`room_${app_id}`).get(roomId).put({name:options.name, id:roomId, isPrivate:options.private, users:{}})
      gun.get(`room_${app_id}`).get(roomId).get('users').get(gun.user().is.alias).put({id:gun.user().is.alias,avatarURL:`https://robohash.org/${gun.user().is.alias}`, name: gun.user().is.alias, presence:true});   
    },
    

    createConvo: options => {
      if (options.user.id !== this.state.user.id) {
        const exists = this.state.user.rooms.find(
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

    isTyping: (room, user) =>
      this.setState(prevState => ({
        typing: {
          ...prevState.typing,
          [room.id]: {
            ...prevState.typing[room.id],
            [user.id]: true
          }
        }
      })),

    notTyping: (room, user) =>
      this.setState(prevState => ({
        typing: {
          ...prevState.typing,
          [room.id]: {
            ...prevState.typing[room.id],
            [user.id]: false
          }
        }
      })),

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

  async componentDidMount() {
    'Notification' in window && Notification.requestPermission()
    const user = await gunAskUsernameAndPassword();
    this.actions.setUser(user)

    globalRoomListener(this.actions.concatRoom)
    normalRoomsListener(this.actions.concatRoom)




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

// --------------------------------------
// Authentication
// --------------------------------------

 window.localStorage.getItem('chatkit-user') &&
   !window.localStorage.getItem('chatkit-user').match(version) &&
   window.localStorage.clear()

const app_id = 'dori_006' 
const params = new URLSearchParams(window.location.search.slice(1))
const authCode = params.get('code')
const existingUser = window.localStorage.getItem('chatkit-user')
const gun = Gun(['http://localhost:8765/gun', 'https://gunjs.herokuapp.com/gun']);



const globalRoomListener = (concatRoom) =>{
  let globalRoom = {}
  gun.get(`global_room_${app_id}`).on(function(data, id){      
    globalRoom = data  
    globalRoom.users = []    
    delete globalRoom['_'] 
    console.log(globalRoom)
    concatRoom([globalRoom])
  });
}

const normalRoomsListener = (concatRoom) =>{
  const normalRooms = []
  gun.get(`room_${app_id}`).map().on(function(data, roomid){
    const cleandata = data
    delete cleandata['_']      
    cleandata.users = []
    normalRooms.push(cleandata)  
    console.log(normalRooms)
    concatRoom(normalRooms)
  }); 
}

const gunAskUsernameAndPassword = async (setUser) => {  
  const user = gun.user();
  const username =  'dori66' //window.prompt('username', 'dori66')
  const password = 'dori66'  //window.prompt('password', 'dori66') 

  return new Promise((resolve, reject)=>{
    gun.user().create(username, password, function(createcbk){      
      gun.user().auth(username, password, function(authcbk){
        if(authcbk['err'])
          alert(authcbk['err'])
        else{
          window.localStorage.setItem('chatkit-user', JSON.stringify({id:user.is.alias, version, pub: user.is.pub}));
          /**
           * create glogal room
           */
          gun.get(`global_room_${app_id}`).put({name:'Global', id:`global_room_${app_id}`, isPrivate:false, users:{}})
          gun.get(`global_room_${app_id}`).get('users').get(gun.user().is.alias).put({id:gun.user().is.alias,avatarURL:`https://robohash.org/${gun.user().is.alias}`, name: gun.user().is.alias, presence:true},function(ack){
            resolve({                  
              id:user.is.alias, 
              name:user.is.alias,
              avatarURL:'https://thispersondoesnotexist.com/image',
              version, 
              pub: user.is.pub, 
              readCursor:{},
          })
          });
        }          
    })
  });
  });
}

  

ReactDOM.render(<View />, document.querySelector('#root'))
