# Wave Chat

## Current State
Direct messaging (Inbox) supports send/receive with `isRead` tracking. Messages are marked read via `markDirectMessagesRead`. No typing indicators exist. No tick-based read receipt UI exists. ConversationSummary has unreadCount but no per-message read status for the last message.

## Requested Changes (Diff)

### Add
- Typing indicator: backend stores typing status per user pair with timestamp; frontend polls and shows "[name] is typing..." in chat thread
- Read receipt ticks in chat thread: single tick (✓) = delivered, double tick (✓✓) = seen; ticks only shown on sender's own messages
- Read receipt ticks in Inbox list: last message shows tick status if sent by current user
- `setTypingStatus(token, recipientUsername, isTyping)` backend method
- `getTypingStatus(token, otherUsername)` backend query returning Bool
- `lastMessageSender` and `lastMessageRead` fields added to ConversationSummary

### Modify
- ConversationSummary type: add `lastMessageSender: Text` and `lastMessageIsRead: Bool`
- ChatWindow.tsx: add tick icons on sent messages, polling for typing status at 2s interval
- Inbox conversation list: show tick status on last message preview

### Remove
- Nothing removed

## Implementation Plan
1. Add typing status map to backend (`typingStatus: Map<Text, Time.Time>` keyed by `sender_recipient`)
2. Add `setTypingStatus` and `getTypingStatus` methods
3. Extend ConversationSummary with `lastMessageSender` and `lastMessageIsRead`
4. Update `getConversations` to populate new fields
5. Frontend ChatWindow: add ✓/✓✓ ticks on outgoing messages, poll typing status, show typing indicator
6. Frontend Inbox list: show tick marks on last message if sent by current user
