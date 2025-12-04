import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Shield } from 'lucide-react';

const SecuritySettings = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background pt-20 pb-32">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Settings
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Shield className="h-8 w-8 text-primary" />
                        Security
                    </h1>
                    <p className="text-muted-foreground mt-2">Protect your account</p>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Security</CardTitle>
                            <CardDescription>Protect your account with additional security measures</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Two-Factor Authentication</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Add an extra layer of security</p>
                                </div>
                                <Button variant="outline">Enable</Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Change Password</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Update your password regularly</p>
                                </div>
                                <Button variant="outline">Change</Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Active Sessions</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Manage your login sessions</p>
                                </div>
                                <Button variant="outline">View</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SecuritySettings;
