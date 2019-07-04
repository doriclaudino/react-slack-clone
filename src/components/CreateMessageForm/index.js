import React from 'react'
import style from './index.module.css'
import { FileInput } from '../FileInput'

let timeout = 0;
export const CreateMessageForm = ({
  state: { user = {}, room = {}, message = '' },
  actions: { runCommand },
}) =>
  room.id ? (
    <form
      className={style.component}
      onSubmit={e => {
        e.preventDefault()

        const message = e.target[0].value.trim()

        if (message.length === 0) {
          return
        }

        e.target[0].value = ''
        
        message.startsWith('/')
          ? runCommand(message.slice(1))
          : user.sendMessage({
            text: message,
            roomId: room.id,
          })
      }}
    >
      <input
        placeholder="Type a Message.."
        onBlur={e => {
          clearTimeout(timeout);
          user.isNotTyping({ roomId: room.id });
        }}
        onInput={e => {
          timeout = clearTimeout(timeout);
          user.isTypingIn({ roomId: room.id });          
          setTimeout(() => {
            user.isNotTyping({ roomId: room.id });
          }, 3000);
        }}
      />
      <FileInput state={{ user, room, message }} />
      <button type="submit">
        <svg>
          <use xlinkHref="index.svg#send" />
        </svg>
      </button>
    </form>
  ) : null
