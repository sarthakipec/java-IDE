const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const os = require('os');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Temporary directory for Java files
const tempDir = path.join(os.tmpdir(), 'java-online-ide');

// Ensure temp directory exists
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

let currentProcess = null;

app.post('/compile', async (req, res) => {
    const { code, fileName } = req.body;
    const javaFileName = `${fileName}.java`;
    const fullPath = path.join(tempDir, javaFileName);

    try {
        await fs.writeFile(fullPath, code);

        // Compile Java file
        await new Promise((resolve, reject) => {
            const compileProcess = spawn('javac', [fullPath]);
            compileProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Compilation failed with code ${code}`));
            });
        });

        // Run Java file
        currentProcess = spawn('java', ['-cp', tempDir, fileName]);

        res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Transfer-Encoding': 'chunked'
        });

        currentProcess.stdout.on('data', (data) => {
            res.write(data);
        });

        currentProcess.stderr.on('data', (data) => {
            res.write(data);
        });

        currentProcess.on('close', (code) => {
            res.end(`\nProcess exited with code ${code}`);
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.toString() });
    }
});

app.post('/input', (req, res) => {
    const { input } = req.body;
    if (currentProcess && currentProcess.stdin.writable) {
        currentProcess.stdin.write(input + '\n');
        res.sendStatus(200);
    } else {
        res.status(400).send('No active process or input not accepted');
    }
});

// Debug endpoint remains the same
app.post('/debug', async (req, res) => {
    const { code, fileName } = req.body;
    const javaFileName = `${fileName}.java`;
    const fullPath = path.join(tempDir, javaFileName);

    try {
        // Write Java file
        await fs.writeFile(fullPath, code);

        // Compile Java file
        await new Promise((resolve, reject) => {
            const compileProcess = spawn('javac', [fullPath]);
            compileProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Compilation failed with code ${code}`));
            });
        });

        // Parse the Java code
        const lines = code.split('\n');
        const debugOutput = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                debugOutput.push(`Line ${i + 1}: ${line}`);
                debugOutput.push(explainJavaCode(line));
            }
        }

        res.json({ debugOutput: debugOutput.join('\n') });

    } catch (error) {
        console.error('Error in /debug endpoint:', error);
        res.status(500).json({ error: error.toString() });
    } finally {
        // Clean up temporary files
        await fs.unlink(fullPath).catch(console.error);
        await fs.unlink(path.join(tempDir, `${fileName}.class`)).catch(console.error);
    }
});

function explainJavaCode(line) {
    // This is a simple explanation function. You can expand it to cover more Java constructs.
    if (line.startsWith('public class')) {
        return `  Explanation: This line declares a public class.`;
    } else if (line.startsWith('public static void main')) {
        return `  Explanation: This is the main method, the entry point of the Java program.`;
    } else if (line.includes('System.out.println')) {
        return `  Explanation: This line prints output to the console.`;
    } else if (line.includes('=')) {
        return `  Explanation: This line assigns a value to a variable.`;
    } else if (line.startsWith('if')) {
        return `  Explanation: This line starts an if statement, used for conditional execution.`;
    } else if (line.startsWith('for')) {
        return `  Explanation: This line starts a for loop, used for iterating.`;
    } else if (line.startsWith('while')) {
        return `  Explanation: This line starts a while loop, used for repeated execution while a condition is true.`;
    } else {
        return `  Explanation: This is a Java statement.`;
    }
}

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
