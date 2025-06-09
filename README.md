# ElevenLabs Conversational AI Agents

This is a [Next.js](https://nextjs.org/) project that implements a conversational AI Agents using ElevenLabs' SDK. The application features a voice assistant interface that allows users to interact with the AI through voice commands.

[ElevenLabs conversational-ai-sdks Document](https://elevenlabs.io/docs/conversational-ai-sdks/javascript/client-sdk)

## Support Me

If you enjoy this project and want to support me, consider buying me a coffee or visiting my personal website to join the membership!

<div style="display: flex; gap: 10px; margin-top: 10px;">
  <a href="https://buymeacoffee.com/aiforsuccess">
    <img src="https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD57?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee">
  </a>
  <a href="https://ashutoshai.com/">
    <img src="https://img.shields.io/badge/Visit_My_Website-4A90E2?style=for-the-badge&logo=internet-explorer&logoColor=white" alt="Visit My Website">
  </a>
</div>

## Prerequisites

1. Visit [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai) to create your agents.
2. Copy the Agent ID that needs to be configured.
3. Note this code uses signed URL so make sure you enable authentication for your agents.

## Environment Variables

Make sure to configure the following variables in your `.env` file:

- `ELEVEN_LABS_API_KEY`
- `NEXT_PUBLIC_AGENT_ID`

## Get Started

To get started with the project, follow these steps:

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd elevenlabs-conversational-ai-agents
   ```

2. Install the dependencies:

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. Run the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application in action.

## Features

- **Voice Assistant**: Interact with the AI using voice commands.
- **Real-time Messaging**: View messages exchanged between the user and the AI.
- **Transcript Download**: Download the conversation transcript as a text file.
- **Responsive Design**: The application is designed to work on various screen sizes.

## License

This project is licensed under the MIT License. For more details, please refer to the [LICENSE](LICENSE) file, which outlines the terms and conditions of this license.
