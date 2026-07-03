import { useChat } from "../../context/ChatContext";
import { RoomListItem } from "./RoomListItem";

interface RoomListProps {
  onSelectRoom: () => void;
}

export function RoomList({ onSelectRoom }: RoomListProps) {
  const { rooms, activeRoomId, selectRoom } = useChat();

  return (
    <div className="flex-1 overflow-y-auto px-2">
      {rooms.map((room) => (
        <RoomListItem
          key={room.id}
          room={room}
          isActive={room.id === activeRoomId}
          onSelect={() => {
            selectRoom(room.id);
            onSelectRoom();
          }}
        />
      ))}
    </div>
  );
}
