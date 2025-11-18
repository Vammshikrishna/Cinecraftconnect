import React from 'react';
import { useRealtimeData } from '@/lib/realtime';

// CORRECTED: Props interface now expects project_id
interface CallSheetProps {
    project_id: string;
}

// CORRECTED: Component now accepts project_id
const CallSheet = ({ project_id }: CallSheetProps) => {
    // CORRECTED: useRealtimeData is now called with project_id
    const { data: callSheetData, error } = useRealtimeData('call_sheets', project_id);

    if (error) {
        return <div>Error loading call sheet: {error.message}</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Call Sheet</h1>
            {/* Added a check to ensure callSheetData is not null or empty before mapping */}
            {callSheetData && callSheetData.map((sheet: any) => (
                <div key={sheet.id} className="space-y-4 bg-slate-800/50 p-6 rounded-lg shadow-md">
                    <div>
                        <h2 className="text-xl font-semibold border-b border-slate-700 pb-2 mb-4">General Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <p><strong className="text-muted-foreground">Date:</strong> {sheet.date}</p>
                            <p><strong className="text-muted-foreground">Call Time:</strong> {sheet.call_time}</p>
                            <p><strong className="text-muted-foreground">Location:</strong> {sheet.location}</p>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold border-b border-slate-700 pb-2 mb-4 mt-6">Contacts</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <p><strong className="text-muted-foreground">Director:</strong> {sheet.director} - {sheet.director_phone}</p>
                            <p><strong className="text-muted-foreground">Producer:</strong> {sheet.producer} - {sheet.producer_phone}</p>
                        </div>
                    </div>
                </div>
            ))}
            {(!callSheetData || callSheetData.length === 0) && (
                <p className="text-muted-foreground">No call sheet available for this project yet.</p>
            )}
        </div>
    );
};

export default CallSheet;
