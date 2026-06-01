import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Captures an HTML element and triggers a PDF download.
 * @param elementId The ID of the HTML element to capture
 * @param filename The name of the downloaded PDF file
 */
export const exportElementToPDF = async (elementId: string, filename: string = 'export.pdf') => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found.`);
        return;
    }

    try {
        // Temporarily style the element for printing if needed
        const originalStyle = element.style.cssText;
        
        // Use html2canvas to render the element to a canvas
        const canvas = await html2canvas(element, {
            scale: 2, // Higher scale for better resolution
            useCORS: true, // Allow cross-origin images to be rendered
            backgroundColor: '#000000', // Match dark theme background
        });

        // Restore original styles
        element.style.cssText = originalStyle;

        const imgData = canvas.toDataURL('image/png');
        
        // Calculate PDF dimensions (A4 size)
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Calculate aspect ratio to fit the canvas inside the PDF page
        const canvasRatio = canvas.width / canvas.height;
        const pdfRatio = pdfWidth / pdfHeight;

        let finalWidth = pdfWidth;
        let finalHeight = pdfHeight;

        if (canvasRatio > pdfRatio) {
            finalHeight = pdfWidth / canvasRatio;
        } else {
            finalWidth = pdfHeight * canvasRatio;
        }

        // Center the image
        const xOffset = (pdfWidth - finalWidth) / 2;
        const yOffset = (pdfHeight - finalHeight) / 2;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
        pdf.save(filename);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};
