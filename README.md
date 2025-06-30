# Mölders Azubi Berater

Dies ist ein moderner Sprachassistent für die Azubi-Beratung bei Mölders. Die App bietet eine intuitive Voice- und Chat-Interaktion im Mölders-Branding.

## Prerequisites

1. Create your agents.
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

This project is licensed under the becoss.de License. For more details, please refer to the file, which outlines the terms and conditions of this license.
