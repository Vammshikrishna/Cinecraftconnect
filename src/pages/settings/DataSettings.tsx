import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, FileText, Database } from 'lucide-react';

const DataSettings = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            // Simulate data export
            await new Promise(resolve => setTimeout(resolve, 2000));

            toast({
                title: "Export Started",
                description: "Your data export has been initiated. You'll receive an email when it's ready.",
            });
        } catch (error) {
            toast({
                title: "Export Failed",
                description: "Failed to export your data. Please try again.",
                variant: "destructive",
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
                        <Database className="h-8 w-8 text-primary" />
                        Data & Privacy
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage your data and privacy settings</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Export</CardTitle>
                            <CardDescription>Download a copy of your data</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-primary/10">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-base font-medium">Export Your Data</Label>
                                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                                        Download all your profile information, posts, projects, and activity.
                                        This includes your profile data, connections, messages, and content.
                                    </p>
                                    <Button
                                        onClick={handleExportData}
                                        disabled={isExporting}
                                        variant="outline"
                                    >
                                        {isExporting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                                Preparing Export...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                Request Data Export
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Data Retention</CardTitle>
                            <CardDescription>How long we keep your data</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 text-sm text-muted-foreground">
                                <p>
                                    <strong className="text-foreground">Active Data:</strong> Your profile, posts, and projects remain active as long as your account is active.
                                </p>
                                <p>
                                    <strong className="text-foreground">Deleted Content:</strong> Deleted posts and messages are permanently removed within 30 days.
                                </p>
                                <p>
                                    <strong className="text-foreground">Account Deletion:</strong> If you delete your account, all data is permanently removed within 90 days.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-sm">Your Privacy Matters</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                We're committed to protecting your privacy. Your data is stored securely with enterprise-grade infrastructure.
                                We never sell your personal information to third parties.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DataSettings;
