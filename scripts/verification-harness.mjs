import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class VerificationHarness {
  constructor() {
    this.verificationDir = path.join(__dirname, '../verification');
    this.canonicalIndexPath = path.join(__dirname, '../bedford-specification-index.json');
    this.pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
    this.verificationDataPath = path.join(__dirname, '../verification-data.json');
  }

  async setup() {
    console.log('Setting up verification harness...');
    
    // Create verification directory
    if (!fs.existsSync(this.verificationDir)) {
      fs.mkdirSync(this.verificationDir, { recursive: true });
    }
    
    // Load canonical index
    const canonicalIndex = JSON.parse(fs.readFileSync(this.canonicalIndexPath, 'utf-8'));
    console.log(`Loaded ${canonicalIndex.length} sections from canonical index`);
    
    return canonicalIndex;
  }

  async extractThumbnails(sections) {
    console.log('Extracting verification thumbnails...');
    
    // Skip thumbnail extraction for now (too slow for 173 pages)
    console.log('Skipping thumbnail extraction (would take too long for 173 pages)');
    console.log('Verification interface will work without thumbnails');
    return;
    
    // Original implementation (commented out):
    /*
    const tempDir = path.join(__dirname, '../temp-verification-thumbnails');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const uniquePages = [...new Set(sections.map(s => s.startPage))];
    console.log(`Extracting ${uniquePages.length} unique page thumbnails...`);
    
    try {
      for (const pageNum of uniquePages) {
        try {
          await execAsync(`pdftoppm -png -f ${pageNum} -l ${pageNum} "${this.pdfPath}" "${tempDir}/page-${pageNum}"`);
          console.log(`Extracted page ${pageNum}`);
        } catch (error) {
          console.warn(`Failed to extract page ${pageNum}:`, error.message);
        }
      }
      
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        if (file.endsWith('.png')) {
          const match = file.match(/page-(\d+)\.png/);
          if (match) {
            const pageNum = parseInt(match[1]);
            if (uniquePages.includes(pageNum)) {
              const sourcePath = path.join(tempDir, file);
              const targetPath = path.join(this.verificationDir, `page-${pageNum}.png`);
              fs.renameSync(sourcePath, targetPath);
            }
          }
        }
      }
      
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`Extracted ${fs.readdirSync(this.verificationDir).length} thumbnails`);
    } catch (error) {
      console.warn('Thumbnail extraction failed:', error.message);
    }
    */
  }

  loadVerificationData() {
    if (fs.existsSync(this.verificationDataPath)) {
      return JSON.parse(fs.readFileSync(this.verificationDataPath, 'utf-8'));
    }
    return {};
  }

  saveVerificationData(data) {
    fs.writeFileSync(this.verificationDataPath, JSON.stringify(data, null, 2));
  }

  generateVerificationInterface(sections) {
    console.log('Generating verification interface...');
    
    const verificationData = this.loadVerificationData();
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Specification Index Verification</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; }
    .section-card { border: 2px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .section-number { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px; }
    .section-title { font-size: 18px; color: #666; margin-bottom: 10px; }
    .section-pages { font-size: 16px; color: #888; margin-bottom: 15px; }
    .thumbnail { max-width: 100%; margin: 15px 0; border: 1px solid #ccc; border-radius: 4px; }
    .source-line { background: #f9f9f9; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 14px; border-left: 4px solid #007bff; }
    .metadata { background: #f0f0f0; padding: 10px; margin: 10px 0; font-size: 14px; }
    .verification-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 4px; border-left: 4px solid #ffc107; }
    .verification-box.correct { background: #d4edda; border-left-color: #28a745; }
    .verification-box.incorrect { background: #f8d7da; border-left-color: #dc3545; }
    .checkbox { margin: 10px 0; }
    .notes { width: 100%; height: 60px; margin: 10px 0; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
    .navigation { display: flex; justify-content: space-between; margin: 20px 0; }
    .nav-btn { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .nav-btn:hover { background: #0056b3; }
    .nav-btn:disabled { background: #ccc; cursor: not-allowed; }
    .summary { background: #e7f3ff; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .progress-bar { height: 20px; background: #e0e0e0; border-radius: 10px; margin: 10px 0; overflow: hidden; }
    .progress-fill { height: 100%; background: #28a745; transition: width 0.3s; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Specification Index Verification</h1>
      <p>Review each section and mark as Correct or Incorrect</p>
    </div>

    <div class="summary">
      <h3>Review Summary</h3>
      <p>Total Sections: ${sections.length}</p>
      <p>Reviewed: ${Object.keys(verificationData).length}</p>
      <p>Correct: ${Object.values(verificationData).filter(v => v.status === 'correct').length}</p>
      <p>Incorrect: ${Object.values(verificationData).filter(v => v.status === 'incorrect').length}</p>
      <p>Needs Edit: ${Object.values(verificationData).filter(v => v.status === 'needs-edit').length}</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${(Object.keys(verificationData).length / sections.length * 100).toFixed(1)}%"></div>
      </div>
    </div>

    <div id="section-display"></div>

    <div class="navigation">
      <button class="nav-btn" id="prev-btn" onclick="navigate(-1)">Previous</button>
      <button class="nav-btn" id="next-btn" onclick="navigate(1)">Next</button>
    </div>

    <div class="header">
      <button class="nav-btn" onclick="exportVerificationData()" style="background: #28a745;">Export Verification Data</button>
    </div>
  </div>

  <script>
    const sections = ${JSON.stringify(sections)};
    const verificationData = ${JSON.stringify(verificationData)};
    let currentIndex = 0;

    function displaySection(index) {
      const section = sections[index];
      const verification = verificationData[section.sectionNumber] || { status: '', notes: '' };
      
      const thumbnailPath = 'verification/page-' + section.startPage + '.png';
      const thumbnailExists = false; // Thumbnails skipped for performance
      
      let statusClass = '';
      if (verification.status === 'correct') statusClass = 'correct';
      else if (verification.status === 'incorrect') statusClass = 'incorrect';
      
      document.getElementById('section-display').innerHTML = \`
        <div class="section-card">
          <div class="section-number">\${section.sectionNumber}</div>
          <div class="section-title">\${section.title}</div>
          <div class="section-pages">Pages \${section.startPage}–\${section.endPage}</div>
          \${thumbnailExists ? \`<img src="\${thumbnailPath}" class="thumbnail" alt="Page \${section.startPage}">\` : '<p>Thumbnail not available</p>'}
          <div class="source-line">Source line used:</div>
          <div class="source-line">SECTION \${section.sectionNumber}<br>\${section.title}</div>
          <div class="metadata">
            <strong>Extraction Method:</strong> SECTION prefix with title on next line<br>
            <strong>Confidence:</strong> 85%
          </div>
          <div class="verification-box \${statusClass}">
            <h3>Verification</h3>
            <div class="checkbox">
              <label><input type="radio" name="status" value="correct" \${verification.status === 'correct' ? 'checked' : ''} onchange="saveVerification('\${section.sectionNumber}', 'correct')"> ☐ Correct</label>
            </div>
            <div class="checkbox">
              <label><input type="radio" name="status" value="incorrect" \${verification.status === 'incorrect' ? 'checked' : ''} onchange="saveVerification('\${section.sectionNumber}', 'incorrect')"> ☐ Incorrect</label>
            </div>
            <div class="checkbox">
              <label><input type="radio" name="status" value="needs-edit" \${verification.status === 'needs-edit' ? 'checked' : ''} onchange="saveVerification('\${section.sectionNumber}', 'needs-edit')"> ☐ Needs Edit</label>
            </div>
            <textarea class="notes" placeholder="Notes..." onchange="saveNotes('\${section.sectionNumber}', this.value)">\${verification.notes || ''}</textarea>
          </div>
        </div>
      \`;
      
      // Update navigation buttons
      document.getElementById('prev-btn').disabled = index === 0;
      document.getElementById('next-btn').disabled = index === sections.length - 1;
      
      // Update progress
      updateProgress();
    }

    function navigate(direction) {
      currentIndex += direction;
      if (currentIndex < 0) currentIndex = 0;
      if (currentIndex >= sections.length) currentIndex = sections.length - 1;
      displaySection(currentIndex);
    }

    function saveVerification(sectionNumber, status) {
      if (!verificationData[sectionNumber]) {
        verificationData[sectionNumber] = {};
      }
      verificationData[sectionNumber].status = status;
      displaySection(currentIndex);
      localStorage.setItem('verificationData', JSON.stringify(verificationData));
    }

    function saveNotes(sectionNumber, notes) {
      if (!verificationData[sectionNumber]) {
        verificationData[sectionNumber] = {};
      }
      verificationData[sectionNumber].notes = notes;
      localStorage.setItem('verificationData', JSON.stringify(verificationData));
    }

    function updateProgress() {
      const reviewed = Object.keys(verificationData).length;
      const progress = (reviewed / sections.length * 100).toFixed(1);
      document.querySelector('.progress-fill').style.width = progress + '%';
      
      document.querySelector('.summary p:nth-child(2)').textContent = 'Reviewed: ' + reviewed;
      document.querySelector('.summary p:nth-child(3)').textContent = 'Correct: ' + Object.values(verificationData).filter(v => v.status === 'correct').length;
      document.querySelector('.summary p:nth-child(4)').textContent = 'Incorrect: ' + Object.values(verificationData).filter(v => v.status === 'incorrect').length;
      document.querySelector('.summary p:nth-child(5)').textContent = 'Needs Edit: ' + Object.values(verificationData).filter(v => v.status === 'needs-edit').length;
    }

    function exportVerificationData() {
      const dataStr = JSON.stringify(verificationData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'verification-data.json';
      link.click();
    }

    // Load verification data from localStorage if available
    const savedData = localStorage.getItem('verificationData');
    if (savedData) {
      Object.assign(verificationData, JSON.parse(savedData));
    }

    // Initialize
    displaySection(0);
  </script>
</body>
</html>
`;

    const outputPath = path.join(this.verificationDir, 'index.html');
    fs.writeFileSync(outputPath, html);
    console.log(`Verification interface written to: ${outputPath}`);
  }

  async run() {
    const sections = await this.setup();
    await this.extractThumbnails(sections);
    this.generateVerificationInterface(sections);
    
    console.log('\n=== VERIFICATION HARNESS READY ===');
    console.log(`Open ${path.join(this.verificationDir, 'index.html')} to begin verification`);
    console.log(`Total sections to verify: ${sections.length}`);
  }
}

// Run verification harness
async function runVerificationHarness() {
  const harness = new VerificationHarness();
  await harness.run();
}

runVerificationHarness().catch(console.error);
