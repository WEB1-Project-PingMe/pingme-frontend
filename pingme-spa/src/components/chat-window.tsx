import MessageInputBox from './message-input'
import MessageList from './message-list'

function ChatWindow() {
  return (
    <section className="border-2 w-[98%] h-[98%] m-2 rounded-lg flex flex-col justify-end p-2">
      <MessageList />
      <MessageInputBox />
    </section>
  )
}

export default ChatWindow;
