import { useState, useEffect, useRef, useMemo } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { 
  BookOpen, 
  UploadCloud, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Loader2, 
  Trash2, 
  Camera, 
  Check, 
  MapPin, 
  Sparkles, 
  Plus, 
  MousePointer, 
  FileText,
  AlertCircle,
  Film
} from 'lucide-react';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { STORAGE_BUCKETS, PROJECT_FILE_FOLDERS, buildProjectFilePath, extractStoragePath } from '@/lib/storage';

// Types
interface Highlight {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ShotNotes {
  notes?: string;
  highlight?: Highlight | null;
}

interface Shot {
  id: string;
  scene: number;
  shot: number;
  description: string;
  status: string;
  notes: string | null;
  project_id: string;
}

interface ScreenplayFile {
  id: string;
  name: string;
  url: string;
  size: number;
  file_type: string | null;
}

interface DetectedScene {
  sceneNumber: number;
  heading: string;
  page: number;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface ScreenplayReaderProps {
  project_id: string;
}

const ScreenplayReader = ({ project_id }: ScreenplayReaderProps) => {
  const { isInternal } = useAppRole();
  const { toast } = useToast();

  // Database hooks
  const { data: rawShots, error: fetchShotsError } = useRealtimeData<Shot>('shot_list', 'project_id', project_id);
  const { data: rawFiles, error: fetchFilesError } = useRealtimeData<ScreenplayFile>('files', 'project_id', project_id);

  // Filter files to only show PDFs
  const screenplays = useMemo(() => {
    return rawFiles?.filter(f => f.name.toLowerCase().endsWith('.pdf')) || [];
  }, [rawFiles]);

  // States
  const [selectedFile, setSelectedFile] = useState<ScreenplayFile | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>('');
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 0.55 : 1.2);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [uploading, setUploading] = useState(false);

  // Scene parsing state
  const [detectedScenes, setDetectedScenes] = useState<DetectedScene[]>([]);
  const [isScanningScenes, setIsScanningScenes] = useState(false);

  // Drawing highlight states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStart, setDrawingStart] = useState({ x: 0, y: 0 });
  const [drawingCurrent, setDrawingCurrent] = useState({ x: 0, y: 0 });
  const [newHighlight, setNewHighlight] = useState<Highlight | null>(null);

  // Selected/Active shot for highlighting
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newShotScene, setNewShotScene] = useState('');
  const [newShotNumber, setNewShotNumber] = useState('');
  const [newShotDesc, setNewShotDesc] = useState('');
  const [newShotNotes, setNewShotNotes] = useState('');
  const [isSubmittingShot, setIsSubmittingShot] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }

    const setupWorker = () => {
      const workerUrl = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      fetch(workerUrl)
        .then(res => res.blob())
        .then(blob => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
          setPdfjsLoaded(true);
        })
        .catch(err => {
          console.error('Worker fetch failed, falling back:', err);
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
          setPdfjsLoaded(true);
        });
    };

    const existingScript = document.getElementById('pdfjs-script');
    if (existingScript) {
      if (window.pdfjsLib) {
        setupWorker();
      } else {
        existingScript.addEventListener('load', setupWorker);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'pdfjs-script';
    script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    script.async = true;
    script.onload = setupWorker;
    document.body.appendChild(script);
  }, []);

  // Fetch signed URL on file selection
  useEffect(() => {
    const getSignedUrl = async () => {
      if (!selectedFile) {
        setSignedUrl('');
        setPdfDoc(null);
        return;
      }

      setLoadingPdf(true);
      try {
        const path = extractStoragePath(selectedFile.url, STORAGE_BUCKETS.PROJECT_FILES)
          || `${PROJECT_FILE_FOLDERS.FILES}/${project_id}/${selectedFile.name}`;

        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.PROJECT_FILES)
          .createSignedUrl(decodeURIComponent(path), 3600);

        if (error) throw error;
        setSignedUrl(data?.signedUrl || selectedFile.url);
        setPageNumber(1);
      } catch (err: any) {
        console.error('Failed to get signed URL:', err);
        // Fallback to public url if signed URL fails
        setSignedUrl(selectedFile.url);
      }
    };

    getSignedUrl();
  }, [selectedFile, project_id]);

  // Load PDF document using loaded library
  useEffect(() => {
    if (!pdfjsLoaded || !signedUrl) return;

    let active = true;
    const loadPdf = async () => {
      try {
        const loadingTask = window.pdfjsLib.getDocument({
          url: signedUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
          fontExtraProperties: true,
          disableFontFace: true // Force fallback to standard readable fonts
        });
        const pdf = await loadingTask.promise;
        if (active) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setLoadingPdf(false);
          // Scan for scenes in background
          triggerSceneScan(pdf);
        }
      } catch (err: any) {
        console.error('Error loading PDF document:', err);
        if (active) {
          toast({
            title: 'Failed to load PDF',
            description: 'The script file could not be parsed as a PDF.',
            variant: 'destructive'
          });
          setLoadingPdf(false);
        }
      }
    };

    loadPdf();
    return () => {
      active = false;
    };
  }, [pdfjsLoaded, signedUrl]);

  // Render current PDF page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let active = true;
    let renderTask: any = null;
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        if (!active) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        
        setDimensions({ width: viewport.width, height: viewport.height });

        const transform = outputScale !== 1 
          ? [outputScale, 0, 0, outputScale, 0, 0] 
          : null;

        const renderContext = {
          canvasContext: context,
          transform: transform,
          viewport: viewport
        };
        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Failed to render page:', err);
        }
      }
    };

    renderPage();
    return () => {
      active = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  // Scan PDF text in background to extract scene headings
  const triggerSceneScan = async (pdf: any) => {
    setIsScanningScenes(true);
    setDetectedScenes([]);
    try {
      const scenes: DetectedScene[] = [];
      let sceneCounter = 1;

      // Extract headings from all pages asynchronously
      for (let pageIdx = 1; pageIdx <= pdf.numPages; pageIdx++) {
        const page = await pdf.getPage(pageIdx);
        const textContent = await page.getTextContent();
        const textItems = textContent.items as any[];
        
        // Group text items by Y coordinate to reconstruct full lines
        // Allow a 5-pixel threshold for characters on the same line to account for baseline shifts
        const linesMap = new Map<number, { text: string, x: number }[]>();
        
        for (const item of textItems) {
          const text = (item.str || '').trim();
          if (!text) continue;
          
          const y = item.transform[5];
          const x = item.transform[4];
          
          let matchedY = -1;
          for (const key of linesMap.keys()) {
            if (Math.abs(key - y) < 5) {
              matchedY = key;
              break;
            }
          }
          if (matchedY === -1) {
            matchedY = y;
            linesMap.set(matchedY, []);
          }
          
          linesMap.get(matchedY)!.push({ text, x });
        }

        // Sort Y descending (PDFs usually have origin at bottom-left)
        const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);

        for (const y of sortedYs) {
          // Sort items in this line by X coordinate
          const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
          const str = lineItems.map(i => i.text).join(' ');
          
          // Match standard scene headers (INT, EXT) with or without period, OR "SCENE X"
          if (/\b(?:INT|EXT|I\/E)[\.\s]/i.test(str) || /^(?:SCENE|SC)\s*[0-9]+/i.test(str)) {
            const headingClean = str.toUpperCase();
            if (!scenes.some(s => s.page === pageIdx && s.heading === headingClean)) {
              // Try to parse explicit scene number
              const sceneNumMatch = str.match(/(?:SCENE|SC)\s*([0-9]+)/i);
              const sceneNum = sceneNumMatch ? parseInt(sceneNumMatch[1]) : sceneCounter++;
              
              scenes.push({
                sceneNumber: sceneNum,
                heading: headingClean,
                page: pageIdx
              });
            }
          }
        }
      }
      setDetectedScenes(scenes);
    } catch (err) {
      console.error('Failed to scan scene headings:', err);
    } finally {
      setIsScanningScenes(false);
    }
  };

  // Helper to parse notes JSON column safely
  const parsedShots = useMemo(() => {
    if (!rawShots) return [];
    return rawShots.map(shot => {
      let notesText = shot.notes || '';
      let highlight: Highlight | null = null;
      
      try {
        if (shot.notes && (shot.notes.startsWith('{') || shot.notes.startsWith('['))) {
          const parsed = JSON.parse(shot.notes) as ShotNotes;
          notesText = parsed.notes || '';
          highlight = parsed.highlight || null;
        }
      } catch (e) {
        // Fallback to raw notes string
      }

      return {
        ...shot,
        cleanNotes: notesText,
        highlight
      };
    });
  }, [rawShots]);

  // Shots on current page
  const pageShots = useMemo(() => {
    return parsedShots.filter(s => s.highlight?.page === pageNumber);
  }, [parsedShots, pageNumber]);

  // Handle screenplay file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid File',
        description: 'Please upload a PDF document.',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      const { uploadFileToSupabase } = await import('@/utils/fileValidation');
      const { url, error: uploadError } = await uploadFileToSupabase(
        file,
        STORAGE_BUCKETS.PROJECT_FILES,
        `${PROJECT_FILE_FOLDERS.FILES}/${project_id}`
      );

      if (uploadError || !url) throw new Error(uploadError || 'Failed to upload screenplay');

      const { data: insertData, error: insertError } = await supabase
        .from('files' as any)
        .insert([
          {
            name: file.name,
            size: file.size,
            url: url,
            project_id: project_id,
            file_type: file.type
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      toast({ title: 'Success', description: 'Screenplay script uploaded!' });
      setSelectedFile(insertData as unknown as ScreenplayFile);
    } catch (err: any) {
      toast({
        title: 'Upload Failed',
        description: err.message || 'Could not upload PDF screenplay',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  // Drawing overlay interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingMode || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDrawingStart({ x, y });
    setDrawingCurrent({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDrawingCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const x = Math.min(drawingStart.x, drawingCurrent.x);
    const y = Math.min(drawingStart.y, drawingCurrent.y);
    const w = Math.abs(drawingStart.x - drawingCurrent.x);
    const h = Math.abs(drawingStart.y - drawingCurrent.y);

    // Minimum size filter to prevent accidental clicks
    if (w > 1.5 && h > 1.5) {
      setNewHighlight({ page: pageNumber, x, y, w, h });
      
      // Auto-detect scene if available on this page
      const sceneOnPage = detectedScenes.find(s => s.page === pageNumber);
      setNewShotScene(sceneOnPage ? sceneOnPage.sceneNumber.toString() : '1');
      
      // Prefill next shot sequence for this scene
      const shotsInScene = parsedShots.filter(s => s.scene === (sceneOnPage ? sceneOnPage.sceneNumber : 1));
      const nextShotNum = shotsInScene.length > 0 
        ? (Math.max(...shotsInScene.map(s => s.shot)) + 1).toString()
        : '1';
      
      setNewShotNumber(nextShotNum);
      setNewShotDesc('');
      setNewShotNotes('');
      setIsAddDialogOpen(true);
    }
    setIsDrawingMode(false);
  };

  // Submit new linked shot annotation
  const handleSaveShot = async () => {
    if (!newShotScene || !newShotNumber || !newShotDesc) {
      toast({
        title: 'Validation Error',
        description: 'Scene, Shot Number, and Description are required fields.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmittingShot(true);
    try {
      const notesJson: ShotNotes = {
        notes: newShotNotes,
        highlight: newHighlight
      };

      const { error } = await supabase
        .from('shot_list' as any)
        .insert([{
          project_id,
          scene: parseInt(newShotScene),
          shot: parseInt(newShotNumber),
          description: newShotDesc,
          status: 'pending',
          notes: JSON.stringify(notesJson)
        }]);

      if (error) throw error;

      toast({ title: 'Shot Linked', description: 'Shot annotation has been successfully saved.' });
      setIsAddDialogOpen(false);
      setNewHighlight(null);
    } catch (err: any) {
      toast({
        title: 'Error Creating Shot',
        description: err.message || 'Failed to save linked shot.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingShot(false);
    }
  };

  // Delete shot
  const handleDeleteShot = async (id: string) => {
    if (!confirm('Are you sure you want to remove this shot annotation?')) return;
    try {
      const { error } = await supabase.from('shot_list' as any).delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Annotation Removed', description: 'Linked shot deleted.' });
      if (activeShotId === id) setActiveShotId(null);
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
    }
  };

  // Render helper for current drawing frame box
  const tempDrawStyle = useMemo(() => {
    if (!isDrawing) return null;
    const x = Math.min(drawingStart.x, drawingCurrent.x);
    const y = Math.min(drawingStart.y, drawingCurrent.y);
    const w = Math.abs(drawingStart.x - drawingCurrent.x);
    const h = Math.abs(drawingStart.y - drawingCurrent.y);
    return {
      left: `${x}%`,
      top: `${y}%`,
      width: `${w}%`,
      height: `${h}%`
    };
  }, [isDrawing, drawingStart, drawingCurrent]);

  return (
    <div className="flex-1 w-full flex flex-col h-full bg-background relative overflow-y-auto lg:overflow-hidden">
      
      {/* Top Header Controls bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border bg-card/60 backdrop-blur-md px-6 py-4 gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] text-primary uppercase">Production Desk</h1>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground text-gradient">Script Annotation Reader</span>
            </div>
          </div>
        </div>

        {/* Action Controls & Document Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {screenplays.length > 0 && (
            <Select 
              value={selectedFile?.id || ''} 
              onValueChange={(id) => setSelectedFile(screenplays.find(f => f.id === id) || null)}
            >
              <SelectTrigger className="w-[200px] h-10 rounded-xl bg-background/50 border-border">
                <SelectValue placeholder="Choose Screenplay" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {screenplays.map(doc => (
                  <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!isInternal && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".pdf" 
                className="hidden" 
              />
              <Button
                variant="outline"
                className="h-10 rounded-xl border-dashed border-border hover:bg-accent/40"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                Upload Script PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main split-screen panel container */}
      {!selectedFile ? (
        // Empty State
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-transparent">
          <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-inner animate-pulse">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground mb-2">No Screenplay Loaded</h2>
          <p className="text-muted-foreground max-w-sm mb-6 text-sm">
            Select an existing PDF script from the dropdown or upload a new script file to establish scene-linked annotations.
          </p>
          {!isInternal && (
            <Button
              className="bg-primary hover:bg-primary/95 rounded-2xl h-12 px-8 font-bold shadow-lg shadow-primary/20"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="animate-spin mr-2" /> : <UploadCloud className="w-5 h-5 mr-2" />}
              Upload Script (PDF)
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 w-full flex flex-col lg:grid lg:grid-cols-12 relative lg:overflow-hidden">
          
          {/* LEFT PANE: Scene Index list (collapsible style) */}
          <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-border bg-card/45 flex flex-col shrink-0 lg:overflow-hidden">
            <div className="p-4 border-b border-border bg-gradient-to-b from-muted/5 to-transparent flex items-center justify-between">
              <h2 className="text-xs font-black tracking-wider text-muted-foreground uppercase">Script Index</h2>
              {isScanningScenes && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>
            
            <div className="flex-none lg:flex-1 overflow-visible lg:overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
              {isScanningScenes && detectedScenes.length === 0 ? (
                <div className="space-y-3 p-2">
                  <EnhancedSkeleton className="h-10 w-full rounded-xl" />
                  <EnhancedSkeleton className="h-10 w-full rounded-xl" />
                  <EnhancedSkeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : detectedScenes.length > 0 ? (
                detectedScenes.map((scene) => (
                  <button
                    key={`scene-idx-${scene.sceneNumber}-${scene.page}`}
                    onClick={() => setPageNumber(scene.page)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-300 border flex flex-col gap-1 group relative overflow-hidden ${
                      pageNumber === scene.page
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-transparent border-transparent hover:bg-accent/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Scene {scene.sceneNumber}</span>
                    <span className="text-xs font-bold truncate leading-tight group-hover:text-foreground">{scene.heading}</span>
                    <span className="text-[9px] text-muted-foreground/60 font-semibold absolute bottom-2 right-3">Page {scene.page}</span>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center opacity-40 py-12">
                  <Sparkles className="w-8 h-8 mb-2" />
                  <p className="text-[11px] font-bold uppercase tracking-wider">No Scenes Found</p>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-1">Automatic parsing couldn't identify INT/EXT headings on pages.</p>
                </div>
              )}
            </div>
          </div>

          {/* CENTER PANE: The PDF Screenplay Reader */}
          <div className="lg:col-span-7 flex flex-col bg-background/30 relative border-b lg:border-b-0 border-border lg:overflow-hidden">
            
            {/* Toolbar controller */}
            <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-3 md:py-2 gap-3 md:gap-0 border-b border-border bg-card/20 shrink-0 select-none">
              <div className="flex items-center justify-center gap-1 w-full md:w-auto">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(p => p - 1)}
                  className="rounded-lg h-9 w-9"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="text-xs font-bold px-2">
                  Page {pageNumber} of {numPages || '?'}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber(p => p + 1)}
                  className="rounded-lg h-9 w-9"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Zoom & Bounding highlight drawing triggers */}
              <div className="flex items-center justify-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
                  className="rounded-lg h-9 w-9"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-[10px] font-bold text-muted-foreground w-12 text-center uppercase tracking-widest">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setScale(s => Math.min(2.5, s + 0.1))}
                  className="rounded-lg h-9 w-9"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                
                {!isInternal && (
                  <Button
                    size="sm"
                    variant={isDrawingMode ? 'default' : 'outline'}
                    className={`h-9 px-4 rounded-xl font-bold transition-all text-xs ${
                      isDrawingMode 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                        : 'border-border hover:bg-accent/40'
                    }`}
                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                  >
                    <Camera className="w-3.5 h-3.5 mr-2" />
                    {isDrawingMode ? 'Drawing Bounding Box' : 'Link Bounding Box'}
                  </Button>
                )}
              </div>
            </div>

            {/* Helper Banner when Drawing Mode is active */}
            {isDrawingMode && (
              <div className="bg-primary/20 border-b border-primary/20 px-6 py-2.5 text-center text-xs font-bold text-primary animate-pulse select-none flex items-center justify-center gap-2 z-10 shrink-0">
                <Sparkles className="w-4 h-4" />
                Click and drag on the script page to draw a visual highlight region for your shot annotation.
              </div>
            )}

            {/* Render Canvas Canvas Container */}
            <div className="flex-none lg:flex-1 w-full overflow-x-auto overflow-y-hidden lg:overflow-auto p-2 md:p-6 flex justify-start md:justify-center bg-neutral-900/60 custom-scrollbar relative">
              {loadingPdf ? (
                <div className="flex flex-col items-center justify-center opacity-30 mt-20">
                  <Loader2 className="w-12 h-12 animate-spin mb-4" />
                  <p className="text-xs font-black tracking-widest uppercase">Parsing Document Elements...</p>
                </div>
              ) : (
                <div 
                  className="relative select-none self-start shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden border border-border/10 mb-12"
                  style={{ width: dimensions.width, height: dimensions.height }}
                >
                  <canvas ref={canvasRef} className="block bg-white" />
                  
                  {/* Drawing / Overlay Box Layer */}
                  <div
                    ref={overlayRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`absolute inset-0 z-10 select-none ${
                      isDrawingMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-auto'
                    }`}
                  >
                    {/* Render existing highlights on this page */}
                    {pageShots.map((shot) => {
                      if (!shot.highlight) return null;
                      const h = shot.highlight;
                      const isActive = activeShotId === shot.id;
                      const isHovered = hoveredHighlightId === shot.id;
                      
                      return (
                        <div
                          key={`hl-${shot.id}`}
                          onMouseEnter={() => setHoveredHighlightId(shot.id)}
                          onMouseLeave={() => setHoveredHighlightId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveShotId(shot.id);
                            // Scroll shot card into view
                            const element = document.getElementById(`shot-card-${shot.id}`);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }}
                          className={`absolute rounded transition-all duration-300 group cursor-pointer border ${
                            isActive 
                              ? 'bg-primary/25 border-primary shadow-[0_0_20px_rgba(var(--primary),0.6)] ring-2 ring-primary animate-pulse'
                              : isHovered
                                ? 'bg-primary/20 border-primary/80 ring-1 ring-primary/30'
                                : 'bg-primary/10 border-primary/30'
                          }`}
                          style={{
                            left: `${h.x}%`,
                            top: `${h.y}%`,
                            width: `${h.w}%`,
                            height: `${h.h}%`
                          }}
                        >
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-card border border-border p-2 rounded-xl shadow-2xl transition-all duration-200 z-50 text-[10px]">
                            <p className="font-black text-primary uppercase tracking-wider mb-0.5">Scene {shot.scene} - Shot {shot.shot}</p>
                            <p className="text-foreground font-semibold truncate italic">"{shot.description}"</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render active temp dragging box */}
                    {isDrawing && tempDrawStyle && (
                      <div 
                        className="absolute bg-primary/20 border-2 border-primary border-dashed rounded z-20 pointer-events-none"
                        style={tempDrawStyle}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Shot list & annotation builder */}
          <div className="lg:col-span-3 lg:border-l border-border bg-card/45 flex flex-col shrink-0 lg:overflow-hidden">
            
            <div className="p-4 border-b border-border bg-gradient-to-b from-muted/5 to-transparent flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black tracking-wider text-muted-foreground uppercase">Shot Annotations</h2>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Linked to current script elements</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setNewHighlight(null);
                  setNewShotScene('1');
                  setNewShotNumber('1');
                  setNewShotDesc('');
                  setNewShotNotes('');
                  setIsAddDialogOpen(true);
                }}
                disabled={isInternal}
                className="h-8 w-8 rounded-lg hover:text-primary"
                title="Create Unlinked Shot"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Shots List */}
            <div className="flex-none lg:flex-1 overflow-visible lg:overflow-y-auto p-4 space-y-4 custom-scrollbar pb-32">
              {parsedShots.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center opacity-40 py-24">
                  <Film className="w-12 h-12 mb-3" />
                  <p className="text-xs font-bold uppercase tracking-wider">No Shots Synced</p>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-1 max-w-[180px]">Link shots to regions in the script or click add above.</p>
                </div>
              ) : (
                parsedShots.map((shot) => {
                  const isActive = activeShotId === shot.id;
                  const isCurrentPage = shot.highlight?.page === pageNumber;
                  
                  return (
                    <div
                      key={shot.id}
                      id={`shot-card-${shot.id}`}
                      onMouseEnter={() => {
                        if (shot.highlight) setHoveredHighlightId(shot.id);
                      }}
                      onMouseLeave={() => setHoveredHighlightId(null)}
                      onClick={() => {
                        setActiveShotId(shot.id);
                        if (shot.highlight?.page) {
                          setPageNumber(shot.highlight.page);
                        }
                      }}
                      className={`group relative bg-card/60 border rounded-2xl p-4 transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg ${
                        isActive
                          ? 'border-primary bg-accent/60 scale-[1.02]'
                          : isCurrentPage
                            ? 'border-primary/20 bg-primary/5'
                            : 'border-border hover:border-primary/20 hover:bg-accent/40'
                      }`}
                    >
                      {/* Top labels */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black tracking-widest text-primary uppercase">SCENE {shot.scene}</span>
                          <div className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[9px] font-black tracking-widest text-primary uppercase">SHOT {shot.shot}</span>
                        </div>

                        {shot.highlight?.page && (
                          <span className="text-[8px] font-black uppercase bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            PG {shot.highlight.page}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs font-bold text-foreground italic border-l-2 border-primary/30 pl-2 leading-relaxed mb-3 break-words">
                        "{shot.description}"
                      </p>

                      {/* Notes field */}
                      {shot.cleanNotes && (
                        <div className="text-[10px] text-muted-foreground/80 leading-normal bg-background/40 p-2 rounded-xl border border-border/50 max-h-24 overflow-y-auto mb-2 select-text whitespace-pre-wrap break-words">
                          {shot.cleanNotes}
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/40 select-none">
                        <span className={`text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                          shot.status === 'completed' ? 'bg-primary/10 text-primary border-primary/20' :
                          shot.status === 'in-progress' ? 'bg-primary/10 text-primary border-primary/20' :
                          'bg-muted/30 text-muted-foreground border-border'
                        }`}>
                          {shot.status.replace('-', ' ')}
                        </span>

                        {!isInternal && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteShot(shot.id);
                            }}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dialog for adding/linking shot */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md bg-card border border-border p-6 rounded-[28px] shadow-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary animate-pulse" />
              Link Shot to Script Highlight
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-normal">
              {newHighlight 
                ? `You've drawn a highlight box on Page ${newHighlight.page}. Give it shot coordinates to link inside your project's workflow.`
                : 'Create a shot annotation linked to your screenplay.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-primary uppercase tracking-wider ml-1">Scene Number</Label>
                <Input
                  type="number"
                  min="1"
                  value={newShotScene}
                  onChange={(e) => setNewShotScene(e.target.value)}
                  placeholder="1"
                  className="bg-background/50 border-border rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-primary uppercase tracking-wider ml-1">Shot Number</Label>
                <Input
                  type="number"
                  min="1"
                  value={newShotNumber}
                  onChange={(e) => setNewShotNumber(e.target.value)}
                  placeholder="1"
                  className="bg-background/50 border-border rounded-xl h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-primary uppercase tracking-wider ml-1">Composition Description</Label>
              <Input
                type="text"
                value={newShotDesc}
                onChange={(e) => setNewShotDesc(e.target.value)}
                placeholder="e.g., Extreme close-up tracking target's movements"
                className="bg-background/50 border-border rounded-xl h-11 focus:border-primary/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-primary uppercase tracking-wider ml-1">Directorial Notes (Optional)</Label>
              <textarea
                value={newShotNotes}
                onChange={(e) => setNewShotNotes(e.target.value)}
                placeholder="e.g., Shallow depth of field, slow lens zoom. Keep framing aligned left."
                className="w-full min-h-[90px] bg-background/50 border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 select-none">
            <Button
              variant="ghost"
              onClick={() => {
                setIsAddDialogOpen(false);
                setNewHighlight(null);
              }}
              className="rounded-xl h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveShot}
              disabled={isSubmittingShot}
              className="bg-primary hover:bg-primary/90 rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/20"
            >
              {isSubmittingShot ? <Loader2 className="animate-spin" /> : 'Confirm Annotation Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScreenplayReader;
