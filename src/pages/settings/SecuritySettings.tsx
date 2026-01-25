import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield, Lock, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SecuritySettings = () => {
    const navigate = useNavigate();
    const { setupEncryption } = useAuth();
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    const handleEnableE2EE = async () => {
        if (!password) {
            toast.error("Please enter your password to secure your keys.");
            return;
        }
        setIsLoading(true);
        try {
            await setupEncryption(password);
            setIsComplete(true);
            toast.success("Encryption keys generated and secured!");
            setPassword('');
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate keys. Please check your password and try again.");
        } finally {
            setIsLoading(false);
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
                        <Shield className="h-8 w-8 text-primary" />
                        Security
                    </h1>
                    <p className="text-muted-foreground mt-2">Protect your account</p>
                </div>

                <div className="space-y-6">
                    {/* Encryption Section */}
                    <Card className="border-green-500/20 bg-green-500/5">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Lock className="h-5 w-5 text-green-500" />
                                <CardTitle>End-to-End Encryption</CardTitle>
                            </div>
                            <CardDescription>
                                Setup secure messaging keys. Your private key will be encrypted with your password and stored safely.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isComplete ? (
                                <div className="flex items-center gap-2 text-green-600 bg-green-100 p-4 rounded-lg">
                                    <CheckCircle className="h-5 w-5" />
                                    <span>Encryption keys are active and valid!</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Confirm Password</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="Enter your login password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            We need your password to encrypt your private key. We do not store your password.
                                        </p>
                                    </div>
                                    <Button onClick={handleEnableE2EE} disabled={isLoading || !password}>
                                        {isLoading ? "Generating Keys..." : "Enable Encryption"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

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
                                <Button variant="outline" disabled>Coming Soon</Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Change Password</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Update your password regularly</p>
                                </div>
                                <Button variant="outline" disabled>Change</Button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium">Active Sessions</Label>
                                    <p className="text-sm text-muted-foreground mt-1">Manage your login sessions</p>
                                </div>
                                <Button variant="outline" disabled>View</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SecuritySettings;
