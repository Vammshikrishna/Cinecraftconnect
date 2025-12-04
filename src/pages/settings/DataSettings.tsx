import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download } from 'lucide-react';

const DataSettings = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast({
                title: "Export Complete",
                description: "Your data has been exported successfully.",
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pt-20 pb-32">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Settings
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Download className="h-8 w-8 text-primary" />
                        Data & Privacy
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage your data and privacy settings</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Management</CardTitle>
                            <CardDescription>Control your data and storage</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Export Your Data</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Download a copy of your account data</p>
                                </div>
                                <Button variant="outline" onClick={handleExportData} disabled={isExporting}>
                                    {isExporting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="mr-2 h-4 w-4" />
                                            Export
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Data Retention</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Control how long we keep your data</p>
                                </div>
                                <Button variant="outline">Manage</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DataSettings;
