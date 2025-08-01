"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { User, Shield, Bell, Palette, Trash2, Save } from 'lucide-react';

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Settings state
  const [settings, setSettings] = useState({
    emailNotifications: true,
    darkMode: false,
    autoSave: true,
    showBookmarks: true,
    showRecentSearches: true,
    skipDeleteConfirmation: false
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('userSettings');
      const skipDeleteConfirmation = localStorage.getItem('gabooja_skip_delete_confirmation') === 'true';
      
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsed,
          skipDeleteConfirmation // Override with the specific setting
        }));
      } else {
        setSettings(prev => ({
          ...prev,
          skipDeleteConfirmation
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Special handling for skipDeleteConfirmation
    if (key === 'skipDeleteConfirmation') {
      if (value) {
        localStorage.setItem('gabooja_skip_delete_confirmation', 'true');
      } else {
        localStorage.removeItem('gabooja_skip_delete_confirmation');
      }
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // Save settings to localStorage
      localStorage.setItem('userSettings', JSON.stringify(settings));
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
              <p className="text-muted-foreground mb-4">
                Please sign in to access your settings.
              </p>
              <Button asChild>
                <a href="/login">Sign In</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and settings
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Account Information</span>
                </CardTitle>
                <CardDescription>
                  Your account details and login information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Username</label>
                    <Input value={user?.username} disabled />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input value={user?.email || 'Not provided'} disabled />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Member Since</label>
                    <Input 
                      value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'} 
                      disabled 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Login</label>
                    <Input 
                      value={user?.loginTime ? new Date(user.loginTime).toLocaleDateString() : 'N/A'} 
                      disabled 
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">Active Account</Badge>
                  <Badge variant="outline">Free Plan</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Security</span>
                </CardTitle>
                <CardDescription>
                  Manage your account security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Change Password
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Enable Two-Factor Authentication
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  View Login History
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="h-5 w-5" />
                  <span>App Preferences</span>
                </CardTitle>
                <CardDescription>
                  Customize your Gabooja experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Dark Mode</label>
                    <p className="text-xs text-muted-foreground">
                      Switch between light and dark themes
                    </p>
                  </div>
                  <Button
                    variant={settings.darkMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('darkMode', !settings.darkMode)}
                  >
                    {settings.darkMode ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Auto-save Bookmarks</label>
                    <p className="text-xs text-muted-foreground">
                      Automatically save creators to bookmarks
                    </p>
                  </div>
                  <Button
                    variant={settings.autoSave ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('autoSave', !settings.autoSave)}
                  >
                    {settings.autoSave ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Show Bookmarks Section</label>
                    <p className="text-xs text-muted-foreground">
                      Display bookmarks in the navigation
                    </p>
                  </div>
                  <Button
                    variant={settings.showBookmarks ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('showBookmarks', !settings.showBookmarks)}
                  >
                    {settings.showBookmarks ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Show Recent Searches</label>
                    <p className="text-xs text-muted-foreground">
                      Display recent analysis history
                    </p>
                  </div>
                  <Button
                    variant={settings.showRecentSearches ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('showRecentSearches', !settings.showRecentSearches)}
                  >
                    {settings.showRecentSearches ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Skip Delete Confirmation</label>
                    <p className="text-xs text-muted-foreground">
                      Skip confirmation dialog when deleting bookmarks
                    </p>
                  </div>
                  <Button
                    variant={settings.skipDeleteConfirmation ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('skipDeleteConfirmation', !settings.skipDeleteConfirmation)}
                  >
                    {settings.skipDeleteConfirmation ? 'On' : 'Off'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Notification Settings</span>
                </CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Email Notifications</label>
                    <p className="text-xs text-muted-foreground">
                      Receive updates via email
                    </p>
                  </div>
                  <Button
                    variant={settings.emailNotifications ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('emailNotifications', !settings.emailNotifications)}
                  >
                    {settings.emailNotifications ? 'On' : 'Off'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trash2 className="h-5 w-5" />
                  <span>Data Management</span>
                </CardTitle>
                <CardDescription>
                  Manage your stored data and account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Export My Data
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Clear Bookmarks
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Clear Recent Searches
                </Button>
                <Button variant="destructive" className="w-full justify-start">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {message && (
          <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {message}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveSettings} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
} 