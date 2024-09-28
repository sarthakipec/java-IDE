const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Temporary directory for Java files
const tempDir = path.join(__dirname, 'temp');

// Ensure temp directory exists
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

app.post('/compile', async (req, res) => {
    const { code, fileName, input } = req.body;
    const javaFileName = `${fileName}.java`;
    const fullPath = path.join(tempDir, javaFileName);

    try {
        // Write Java file
        await fs.writeFile(fullPath, code);

        // Compile Java file
        await new Promise((resolve, reject) => {
            exec(`javac ${fullPath}`, (error, stdout, stderr) => {
                if (error) reject(stderr);
                else resolve(stdout);
            });
        });

        // Run Java program
        const result = await new Promise((resolve, reject) => {
            const process = exec(`java -cp ${tempDir} ${fileName}`, (error, stdout, stderr) => {
                if (error) reject(stderr);
                else resolve(stdout);
            });

            // Provide input if available
            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });

        res.json({ output: result });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        // Clean up temporary files
        await fs.unlink(fullPath).catch(console.error);
        await fs.unlink(path.join(tempDir, `${fileName}.class`)).catch(console.error);
    }
});

app.post('/debug', async (req, res) => {
    const { code, fileName, input } = req.body;
    const javaFileName = `${fileName}.java`;
    const fullPath = path.join(tempDir, javaFileName);

    try {
        // Write Java file
        await fs.writeFile(fullPath, code);

        // Compile Java file with debug information
        await new Promise((resolve, reject) => {
            exec(`javac -g ${fullPath}`, (error, stdout, stderr) => {
                if (error) reject(stderr);
                else resolve(stdout);
            });
        });

        // Run Java program with JDB (Java Debugger)
        const result = await new Promise((resolve, reject) => {
            const jdbCommand = `jdb -classpath ${tempDir} ${fileName}`;
            const process = exec(jdbCommand, (error, stdout, stderr) => {
                if (error) reject(stderr);
                else resolve(stdout);
            });

            // Send some basic debug commands
            process.stdin.write('stop in ' + fileName + '.main\n');
            process.stdin.write('run\n');
            process.stdin.write('step\n');
            process.stdin.write('locals\n');
            process.stdin.write('cont\n');
            process.stdin.write('quit\n');

            // Provide input if available
            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });

        res.json({ output: result });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    } finally {
        // Clean up temporary files
        await fs.unlink(fullPath).catch(console.error);
        await fs.unlink(path.join(tempDir, `${fileName}.class`)).catch(console.error);
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});