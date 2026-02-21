import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

import { ChatApp } from "@/components/chat/chat-app";

export default function HomePage() {
  return (
    <>
      <SignedIn>
        <ChatApp />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
