import { Button } from "@/components/ui/button"
import { BadgeCheckIcon, ChevronRightIcon } from "lucide-react"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

function MessageList() {
  const messages = [
    {
      id: 1,
      text: "Hello, world!",
      senderId: 123
    },
    {
      id: 2,
      text: "How are you?",
      senderId: 456
    },
    {
      id: 3,
      text: "Goodbye!",
      senderId: 123
    }
  ]

  return (
    <>
    { messages.map((message) => (
      <div key={message.id} className="flex w-full max-w-md flex-col gap-6">
        <Item variant="outline" size="sm" asChild>
          <a href="#">
            <ItemContent>
              <ItemTitle>{message.text}</ItemTitle>
            </ItemContent>
          </a>
        </Item>
      </div>
    ))}
    </>
  )
}

export default MessageList;
