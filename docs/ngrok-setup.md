# Local Hosting Guide (Ngrok Method)

This guide explains how to host the AI Service on your own Windows computer for free using Ngrok. This bypasses all cloud memory limits and is perfect for running the system live during a wedding.

## Prerequisites
1. You must have your `ai-service` running in a terminal.
2. The computer you use for this must stay **awake and connected to Wi-Fi** for the entire duration of the wedding.

---

## Step 1: Download and Extract Ngrok

1. Open your web browser and go to [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup).
2. Create a free account (you can sign up with Google or GitHub).
3. Once logged in, click the **Download for Windows** button on the dashboard.
4. Locate the downloaded file (usually in your `Downloads` folder, named something like `ngrok-v3-stable-windows-amd64.zip`).
5. **Right-click** the `.zip` file and select **Extract All...**. 
6. Extract it to a folder you can easily find (e.g., `C:\ngrok`). You should now have a file named `ngrok.exe` in that folder.

## Step 2: Authenticate your Ngrok Account

1. Go back to your [Ngrok Dashboard](https://dashboard.ngrok.com/) in your web browser.
2. On the left sidebar, click **Getting Started** -> **Your Authtoken**.
3. Click the **Copy** button to copy your secret token.
4. On your Windows computer, open the **Command Prompt** (Press the Windows Key, type `cmd`, and hit Enter).
5. In the Command Prompt, navigate to the folder where you extracted ngrok. For example, if you extracted it to `C:\ngrok`, type:
   ```cmd
   cd C:\ngrok
   ```
6. Now, run the authentication command (replace `<YOUR_TOKEN>` with the token you copied):
   ```cmd
   ngrok config add-authtoken <YOUR_TOKEN>
   ```
   *(You only ever have to do this step once on this computer!)*

## Step 3: Start the Ngrok Tunnel

Make sure your AI service is already running! (You should have a terminal open running `python main.py` in the `ai-service` folder, which runs on port `8001`).

1. In the same Command Prompt where you authenticated ngrok, type the following command and press Enter:
   ```cmd
   ngrok http 8001
   ```
2. The terminal screen will change and show a dashboard. Look for the line that says **Forwarding**.
3. It will look something like this:
   `Forwarding        https://a1b2-34-56-78-90.ngrok-free.app -> http://localhost:8001`
4. **Copy that URL** (`https://a1b2-34-56-78-90.ngrok-free.app`). Make sure to copy the `https` one, not the `http` one.

⚠️ **WARNING:** Do not close this terminal! If you close it, the tunnel shuts down. If you restart it, you will get a *new* URL and have to repeat Step 4.

## Step 4: Connect your Vercel Web App

Now we need to tell your live website on Vercel to send the guest selfies to this new Ngrok URL.

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click on your Wedding Photo project.
2. Click on the **Settings** tab at the top.
3. On the left sidebar, click **Environment Variables**.
4. Scroll down to find `AI_SERVICE_URL`.
5. Click the three dots (`...`) next to it and select **Edit**.
6. Replace the old value with your new Ngrok URL (e.g., `https://a1b2-34-56-78-90.ngrok-free.app`). Click **Save**.
7. *Crucial Final Step:* Vercel does not apply variable changes immediately. Click the **Deployments** tab at the top.
8. Click the three dots (`...`) on your most recent deployment and click **Redeploy**. Leave all checkboxes as they are and click **Redeploy** again.

## Step 5: Test the System!

1. Once Vercel finishes deploying (usually takes 1-2 minutes), grab your smartphone.
2. Turn off Wi-Fi on your phone (use cellular data to ensure you are testing it from the "outside world").
3. Go to your live Vercel website (e.g., `https://springs-photo-system-web.vercel.app/FindPhotos`).
4. Upload a selfie! 

If everything is working, the website will send the photo to Vercel -> Vercel will send it to the Ngrok URL -> Ngrok sends it directly to your laptop -> your laptop processes the face and returns the matches!
